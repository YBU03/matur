package id.matoer.pos

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/**
 * Dipanggil dari web POS sebagai `window.MatoerAndroid` (lihat src/lib/printer-bt.ts di proyek web).
 * Semua metode berjalan di thread latar WebView; hasil cetak dikirim balik lewat
 * `window.__matoerCetak(id, berhasil, pesan)`.
 */
@SuppressLint("MissingPermission") // izin BLUETOOTH_CONNECT diperiksa lewat izinAda()
class JembatanPos(private val aktivitas: MainActivity) {

    private val pref = aktivitas.getSharedPreferences("printer", Context.MODE_PRIVATE)
    private val antrean = Executors.newSingleThreadExecutor() // satu cetakan pada satu waktu

    @JavascriptInterface
    fun versi(): String = BuildConfig.VERSION_NAME

    private fun izinAda(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(aktivitas, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun mintaIzin() = aktivitas.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) aktivitas.mintaIzin.launch(arrayOf(Manifest.permission.BLUETOOTH_CONNECT))
    }

    /** Printer yang sudah dipasangkan (paired) di Pengaturan Bluetooth tablet. */
    @JavascriptInterface
    fun daftarPrinter(): String {
        val hasil = JSONObject()
        if (!izinAda()) {
            mintaIzin()
            return hasil.put("izin", false).toString()
        }
        val adaptor = PrinterBluetooth.adaptor(aktivitas)
        hasil.put("izin", true).put("ada", adaptor != null).put("aktif", adaptor?.isEnabled == true)
        val daftar = JSONArray()
        try {
            adaptor?.bondedDevices?.sortedBy { it.name ?: "" }?.forEach {
                daftar.put(JSONObject().put("nama", it.name ?: it.address).put("alamat", it.address).put("tipe", PrinterBluetooth.namaTipe(it.type)))
            }
        } catch (e: SecurityException) {
            hasil.put("izin", false)
        }
        return hasil.put("perangkat", daftar).toString()
    }

    @JavascriptInterface
    fun pilihPrinter(alamat: String, nama: String) {
        pref.edit().putString("alamat", alamat).putString("nama", nama).apply()
    }

    @JavascriptInterface
    fun printerTerpilih(): String {
        val alamat = pref.getString("alamat", null) ?: return ""
        return JSONObject().put("alamat", alamat).put("nama", pref.getString("nama", alamat)).toString()
    }

    @JavascriptInterface
    fun lupakanPrinter() {
        pref.edit().clear().apply()
    }

    /** Cetak byte ESC/POS (base64) ke printer terpilih. */
    @JavascriptInterface
    fun cetak(base64: String, id: String) {
        val alamat = pref.getString("alamat", null)
        if (alamat == null) return balas(id, false, "Pilih printer dulu di menu Printer.")
        if (!izinAda()) {
            mintaIzin()
            return balas(id, false, "Izinkan akses Bluetooth (Perangkat di sekitar), lalu cetak lagi.")
        }
        val data = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            return balas(id, false, "Data struk tidak valid.")
        }
        antrean.execute {
            val r = PrinterBluetooth.cetak(aktivitas, alamat, data)
            balas(id, r.berhasil, r.pesan)
        }
    }

    private fun balas(id: String, ok: Boolean, pesan: String) = aktivitas.runOnUiThread {
        val js = "window.__matoerCetak && window.__matoerCetak(${JSONObject.quote(id)}, $ok, ${JSONObject.quote(pesan)})"
        aktivitas.web.evaluateJavascript(js, null)
    }

    /** Simpan file (mis. PDF struk) ke folder Download. Mengembalikan pesan untuk ditampilkan. */
    @JavascriptInterface
    fun simpanFile(base64: String, nama: String, mime: String): String {
        val aman = nama.replace(Regex("[\\\\/:*?\"<>|]"), "-").take(120)
        return try {
            val isi = Base64.decode(base64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val nilai = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, aman)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Matoer")
                }
                val uri = aktivitas.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, nilai)
                    ?: throw IllegalStateException("Penyimpanan tidak tersedia")
                aktivitas.contentResolver.openOutputStream(uri)?.use { it.write(isi) }
                tampil("Tersimpan: Download/Matoer/$aman")
            } else {
                val folder = File(aktivitas.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Matoer").apply { mkdirs() }
                File(folder, aman).writeBytes(isi)
                tampil("Tersimpan: ${folder.absolutePath}/$aman")
            }
        } catch (e: Exception) {
            tampil("Gagal menyimpan file: ${e.message ?: "tidak diketahui"}")
        }
    }

    private fun tampil(pesan: String): String {
        aktivitas.runOnUiThread { Toast.makeText(aktivitas, pesan, Toast.LENGTH_LONG).show() }
        return pesan
    }

    @JavascriptInterface
    fun muatUlang() = aktivitas.muatUlang()
}
