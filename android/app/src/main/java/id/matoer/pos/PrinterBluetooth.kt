package id.matoer.pos

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.os.Build
import java.io.IOException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Cetak ke printer thermal Bluetooth (ESC/POS).
 * 1) Bluetooth klasik (SPP/RFCOMM) — jalur yang dipakai aplikasi kasir pada umumnya (mis. RPP02N).
 * 2) Bila gagal dan printer mendukung BLE: tulis lewat GATT ke jalur cetak yang dikenal.
 */
@SuppressLint("MissingPermission") // izin BLUETOOTH_CONNECT diperiksa di JembatanPos sebelum memanggil
object PrinterBluetooth {

    data class Hasil(val berhasil: Boolean, val pesan: String)

    private val SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")

    // jalur cetak BLE yang dikenal (urut prioritas), sama dengan versi web
    private val JALUR_CETAK = listOf(
        "00002af1", "0000fff2", "0000ff02", "0000ffe1", "49535343-8841-43f4-a8d4-ecbe34729bb3",
        "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", "0000ae01", "0000af01", "0000ff82", "0000ffb2", "0000fec7",
    )

    fun adaptor(ctx: Context): BluetoothAdapter? = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    fun namaTipe(t: Int) = when (t) {
        BluetoothDevice.DEVICE_TYPE_CLASSIC -> "klasik"
        BluetoothDevice.DEVICE_TYPE_LE -> "BLE"
        BluetoothDevice.DEVICE_TYPE_DUAL -> "klasik+BLE"
        else -> "tidak diketahui"
    }

    fun cetak(ctx: Context, alamat: String, data: ByteArray): Hasil {
        val ad = adaptor(ctx) ?: return Hasil(false, "Tablet ini tidak punya Bluetooth.")
        if (!ad.isEnabled) return Hasil(false, "Bluetooth tablet mati. Nyalakan Bluetooth lalu cetak lagi.")
        val dev = try {
            ad.getRemoteDevice(alamat)
        } catch (e: IllegalArgumentException) {
            return Hasil(false, "Alamat printer tidak valid. Pilih ulang printer.")
        }
        var galatSpp = ""
        if (dev.type != BluetoothDevice.DEVICE_TYPE_LE) {
            try {
                cetakSpp(ad, dev, data)
                return Hasil(true, "Struk terkirim ke ${dev.name ?: alamat}.")
            } catch (e: Exception) {
                galatSpp = e.message ?: "gagal"
            }
        }
        if (dev.type == BluetoothDevice.DEVICE_TYPE_LE || dev.type == BluetoothDevice.DEVICE_TYPE_DUAL || dev.type == BluetoothDevice.DEVICE_TYPE_UNKNOWN) {
            try {
                cetakBle(ctx, dev, data)
                return Hasil(true, "Struk terkirim ke ${dev.name ?: alamat} (BLE).")
            } catch (e: Exception) {
                return Hasil(false, "Gagal mencetak: ${e.message ?: "BLE gagal"}${if (galatSpp.isNotEmpty()) " / klasik: $galatSpp" else ""}. Pastikan printer menyala, kertas ada, dan tidak tersambung ke HP lain.")
            }
        }
        return Hasil(false, "Gagal mencetak: $galatSpp. Pastikan printer menyala, kertas ada, dan tidak tersambung ke HP lain.")
    }

    /** SPP: coba soket aman → tidak aman → kanal 1 (cara lama yang dibutuhkan sebagian printer murah). */
    private fun cetakSpp(ad: BluetoothAdapter, dev: BluetoothDevice, data: ByteArray) {
        ad.cancelDiscovery()
        val cara = listOf<() -> BluetoothSocket>(
            { dev.createRfcommSocketToServiceRecord(SPP) },
            { dev.createInsecureRfcommSocketToServiceRecord(SPP) },
            { dev.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType).invoke(dev, 1) as BluetoothSocket },
        )
        var galat: Exception? = null
        for (buat in cara) {
            var soket: BluetoothSocket? = null
            try {
                soket = buat()
                soket.connect()
                val out = soket.outputStream
                var i = 0
                while (i < data.size) {
                    val n = minOf(512, data.size - i)
                    out.write(data, i, n)
                    out.flush()
                    i += n
                    Thread.sleep(20)
                }
                Thread.sleep(400) // biarkan buffer printer tercetak sebelum soket ditutup
                return
            } catch (e: Exception) {
                galat = e
            } finally {
                try {
                    soket?.close()
                } catch (_: IOException) {
                }
            }
        }
        throw galat ?: IOException("Tidak bisa tersambung")
    }

    private fun cetakBle(ctx: Context, dev: BluetoothDevice, data: ByteArray) {
        val siap = CountDownLatch(1)
        var tulisSelesai = CountDownLatch(1)
        var gattOk: BluetoothGatt? = null
        var galat: String? = null
        val cb = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, state: Int) {
                if (state == BluetoothProfile.STATE_CONNECTED) g.discoverServices()
                else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                    galat = galat ?: "koneksi BLE terputus"
                    siap.countDown()
                    tulisSelesai.countDown()
                }
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                gattOk = g
                siap.countDown()
            }

            override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
                tulisSelesai.countDown()
            }
        }
        val gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) dev.connectGatt(ctx, false, cb, BluetoothDevice.TRANSPORT_LE) else dev.connectGatt(ctx, false, cb)
        try {
            if (!siap.await(12, TimeUnit.SECONDS) || gattOk == null) throw IOException(galat ?: "printer BLE tidak merespons")
            val semua = gatt.services.flatMap { it.characteristics }.filter {
                it.properties and (BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
            }
            val ch = semua.minByOrNull { c ->
                val u = c.uuid.toString().lowercase()
                JALUR_CETAK.indexOfFirst { u.startsWith(it) }.let { if (it < 0) 100 else it }
            } ?: throw IOException("jalur cetak BLE tidak ditemukan")
            val denganBalas = ch.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0
            ch.writeType = if (denganBalas) BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT else BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            var i = 0
            while (i < data.size) {
                val potong = data.copyOfRange(i, minOf(i + 20, data.size))
                tulisSelesai = CountDownLatch(1)
                val terkirim = if (Build.VERSION.SDK_INT >= 33) {
                    gatt.writeCharacteristic(ch, potong, ch.writeType) == BluetoothStatusCodes.SUCCESS
                } else {
                    @Suppress("DEPRECATION")
                    run { ch.value = potong; gatt.writeCharacteristic(ch) }
                }
                if (!terkirim) throw IOException("gagal menulis ke printer BLE")
                if (denganBalas) tulisSelesai.await(3, TimeUnit.SECONDS) else Thread.sleep(25)
                i += 20
            }
            Thread.sleep(300)
        } finally {
            gatt.disconnect()
            gatt.close()
        }
    }
}
