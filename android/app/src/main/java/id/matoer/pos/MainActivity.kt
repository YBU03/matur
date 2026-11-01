package id.matoer.pos

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Layar utama Matoer POS: membuka https://matoer.id/pos di WebView layar penuh.
 * - Halaman tetap dari server, jadi fitur POS ikut update tanpa pasang ulang aplikasi.
 * - Jembatan "MatoerAndroid" (lihat JembatanPos) memberi akses printer Bluetooth & simpan file.
 */
class MainActivity : AppCompatActivity() {

    lateinit var web: WebView
        private set
    private var pilihFile: ValueCallback<Array<Uri>>? = null
    private val ambilFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { hasil ->
        pilihFile?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(hasil.resultCode, hasil.data))
        pilihFile = null
    }
    val mintaIzin = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) // layar tidak mati saat kasir bekerja
        layarPenuh()

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false // suara notifikasi pembayaran QRIS
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            userAgentString = "$userAgentString MatoerPOS/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        web.addJavascriptInterface(JembatanPos(this), "MatoerAndroid")
        web.webViewClient = Klien()
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                pilihFile?.onReceiveValue(null)
                pilihFile = callback
                return try {
                    ambilFile.launch(params.createIntent())
                    true
                } catch (e: ActivityNotFoundException) {
                    pilihFile = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack()
                else AlertDialog.Builder(this@MainActivity)
                    .setTitle("Keluar dari Matoer POS?")
                    .setMessage("Transaksi yang sudah dibayar tetap tersimpan.")
                    .setPositiveButton("Keluar") { _, _ -> finish() }
                    .setNegativeButton("Batal", null)
                    .show()
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl(BuildConfig.BASE_URL + BuildConfig.START_PATH)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush() // sesi login tetap tersimpan
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) layarPenuh()
    }

    private fun layarPenuh() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    fun muatUlang() = runOnUiThread { web.loadUrl(BuildConfig.BASE_URL + BuildConfig.START_PATH) }

    private inner class Klien : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            val milikKita = uri.scheme == "https" && (uri.host == "matoer.id" || uri.host?.endsWith(".matoer.id") == true)
            if (milikKita) return false
            // tautan luar (WhatsApp, Maps, RawBT, dll.) dibuka di aplikasi lain
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                true
            } catch (e: ActivityNotFoundException) {
                true
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) view.loadUrl("file:///android_asset/offline.html")
        }
    }
}
