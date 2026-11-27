package com.kash.cleancooking

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {
  private lateinit var rootContainer: FrameLayout
  private lateinit var webView: WebView
  private var tts: TextToSpeech? = null
  private var ttsReady = false
  private val timerChannelId = "clean_cooking_timers"

  private val requestNotificationPermission =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      tts?.language = Locale.UK
      ttsReady = true
    }
  }

  inner class AndroidMealieBridge {
    @JavascriptInterface
    fun fetchJson(urlString: String, bearerToken: String): String {
      return try {
        val url = URL(urlString)
        val conn = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          connectTimeout = 15000
          readTimeout = 15000
          setRequestProperty("Accept", "application/json")
          setRequestProperty("User-Agent", "CleanCookingApp/3.0")
          if (bearerToken.isNotBlank()) {
            setRequestProperty("Authorization", "Bearer $bearerToken")
          }
        }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.let { s ->
          BufferedReader(InputStreamReader(s, Charsets.UTF_8)).use { it.readText() }
        } ?: ""
        conn.disconnect()
        """{"status":$code,"ok":${code in 200..299},"body":${org.json.JSONObject.quote(body)}}"""
      } catch (e: Exception) {
        """{"status":0,"ok":false,"error":${org.json.JSONObject.quote(e.message ?: "Network error")}}"""
      }
    }

    @JavascriptInterface
    fun setKeepScreenOn(enabled: Boolean) {
      runOnUiThread {
        if (enabled) {
          window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      }
    }

    @JavascriptInterface
    fun readAsset(relativePath: String): String {
      return try {
        val clean = relativePath.trimStart('/')
        assets.open("www/$clean").bufferedReader(Charsets.UTF_8).use { it.readText() }
      } catch (_: Exception) {
        ""
      }
    }

    @JavascriptInterface
    fun speak(text: String) {
      runOnUiThread {
        if (ttsReady && text.isNotBlank()) {
          tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "clean_cooking_step")
        }
      }
    }

    @JavascriptInterface
    fun startNativeTimer(seconds: Int, title: String, message: String) {
      runOnUiThread {
        try {
          val intent = Intent(this@MainActivity, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_START
            putExtra(TimerForegroundService.EXTRA_SECONDS, seconds)
            putExtra(TimerForegroundService.EXTRA_TITLE, title)
            putExtra(TimerForegroundService.EXTRA_MESSAGE, message)
          }
          ContextCompat.startForegroundService(this@MainActivity, intent)
        } catch (_: Exception) {
        }
      }
    }

    @JavascriptInterface
    fun stopNativeTimer() {
      runOnUiThread {
        try {
          val intent = Intent(this@MainActivity, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_STOP
          }
          startService(intent)
        } catch (_: Exception) {
        }
      }
    }

    @JavascriptInterface
    fun notifyTimerComplete(title: String, message: String) {
      runOnUiThread {
        showTimerNotification(title, message)
      }
    }
  }

  private fun createTimerNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val name = "Cooking & Preheat Timers"
      val descriptionText = "Alerts when oven preheat or recipe cooking timers finish"
      val importance = NotificationManager.IMPORTANCE_HIGH
      val channel = NotificationChannel(timerChannelId, name, importance).apply {
        description = descriptionText
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 500)
      }
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }

  private fun ensureNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED
      ) {
        requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
      }
    }
  }

  private fun showTimerNotification(title: String, message: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      1001,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    val notification = NotificationCompat.Builder(this, timerChannelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(NotificationCompat.BigTextStyle().bigText(message))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setSound(soundUri)
      .setVibrate(longArrayOf(0, 300, 150, 300, 150, 500))
      .setContentIntent(pendingIntent)
      .build()

    nm.notify((System.currentTimeMillis() % 100000).toInt(), notification)
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    tts = TextToSpeech(this, this)
    createTimerNotificationChannel()
    ensureNotificationPermission()

    val darkBg = Color.parseColor("#090d16")
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(darkBg),
      navigationBarStyle = SystemBarStyle.dark(darkBg)
    )

    val assetLoader = WebViewAssetLoader.Builder()
      .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
      .build()

    webView = WebView(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(darkBg)

      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        allowFileAccess = true
        mediaPlaybackRequiresUserGesture = false
        mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        cacheMode = WebSettings.LOAD_DEFAULT
        useWideViewPort = true
        loadWithOverviewMode = false
        textZoom = 100
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
      }

      addJavascriptInterface(AndroidMealieBridge(), "AndroidMealieBridge")
      webChromeClient = WebChromeClient()

      webViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(
          view: WebView,
          request: WebResourceRequest
        ): WebResourceResponse? {
          return assetLoader.shouldInterceptRequest(request.url)
        }

        override fun shouldOverrideUrlLoading(
          view: WebView,
          request: WebResourceRequest
        ): Boolean {
          val url = request.url.toString()
          if (url.startsWith("https://appassets.androidplatform.net/")) {
            return false
          }
          return try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            true
          } catch (_: Exception) {
            false
          }
        }
      }
    }

    rootContainer = FrameLayout(this).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(darkBg)
      addView(webView)
    }

    ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { v, insets ->
      val safeInsets = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or
          WindowInsetsCompat.Type.displayCutout() or
          WindowInsetsCompat.Type.ime()
      )
      v.setPadding(safeInsets.left, safeInsets.top, safeInsets.right, safeInsets.bottom)
      WindowInsetsCompat.CONSUMED
    }

    setContentView(rootContainer)
    ViewCompat.requestApplyInsets(rootContainer)

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView.canGoBack()) {
          webView.goBack()
        } else {
          finish()
        }
      }
    })

    if (savedInstanceState == null) {
      webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    } else {
      webView.restoreState(savedInstanceState)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (::rootContainer.isInitialized) {
      ViewCompat.requestApplyInsets(rootContainer)
      rootContainer.requestLayout()
    }
    if (::webView.isInitialized) {
      webView.requestLayout()
    }
  }

  override fun onDestroy() {
    tts?.stop()
    tts?.shutdown()
    super.onDestroy()
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    webView.saveState(outState)
  }
}
