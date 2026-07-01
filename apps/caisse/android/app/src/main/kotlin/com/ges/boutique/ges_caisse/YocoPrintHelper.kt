package com.ges.boutique.ges_caisse

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.yoco.payments.sdk.YocoSDK
import com.yoco.payments.sdk.data.enums.SDKEnvironment

/**
 * Impression bon de sortie GES sur terminal Yoco (ticket thermique ~80 mm).
 * - Sans secret : PrintManager Android (recommandé pour print-only).
 * - Avec secret : initialise aussi YocoSDK (optionnel, pour matériel Yoco).
 */
class YocoPrintHelper(private val activity: Activity) {
    companion object {
        private const val TAG = "YocoPrintHelper"
        private const val PERMISSION_REQUEST = 9001

        /** ~80 mm de largeur utile (rouleau thermique POS). */
        private val THERMAL_80MM = PrintAttributes.MediaSize(
            "THERMAL_80MM",
            "android",
            3150,
            50000,
        )
    }

    private var yocoConfigured = false

    fun configure(
        secret: String,
        sandbox: Boolean,
        onResult: (Boolean, String?) -> Unit,
    ) {
        if (secret.isBlank()) {
            onResult(true, null)
            return
        }

        requestRuntimePermissions {
            try {
                val env = if (sandbox) {
                    SDKEnvironment.entries.firstOrNull {
                        it.name.equals("SANDBOX", true) || it.name.equals("STAGING", true)
                    } ?: SDKEnvironment.PRODUCTION
                } else {
                    SDKEnvironment.PRODUCTION
                }
                YocoSDK.configure(
                    context = activity.applicationContext,
                    secret = secret,
                    environment = env,
                    enableLogging = false,
                )
                yocoConfigured = true
                Log.i(TAG, "Yoco SDK configured (env=$env)")
                onResult(true, null)
            } catch (e: Exception) {
                Log.w(TAG, "Yoco configure skipped: ${e.message}")
                yocoConfigured = false
                onResult(true, null)
            }
        }
    }

    fun printReceipt(
        text: String,
        html: String?,
        jobName: String,
        onResult: (Boolean, String?) -> Unit,
    ) {
        activity.runOnUiThread {
            try {
                val content = html?.takeIf { it.isNotBlank() } ?: buildReceiptHtml(text)
                val webView = WebView(activity)
                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String) {
                        val printManager = activity.getSystemService(PrintManager::class.java)
                        val adapter = webView.createPrintDocumentAdapter(jobName)
                        printManager.print(
                            jobName,
                            adapter,
                            PrintAttributes.Builder()
                                .setMediaSize(THERMAL_80MM)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                                .build(),
                        )
                        onResult(true, null)
                    }
                }
                webView.loadDataWithBaseURL(null, content, "text/HTML", "UTF-8", null)
            } catch (e: Exception) {
                Log.e(TAG, "Print failed", e)
                onResult(false, e.message ?: "Impression impossible")
            }
        }
    }

    private fun buildReceiptHtml(text: String): String {
        val escaped = text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        return """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8"/>
              <style>
                @page { size: 80mm auto; margin: 2mm; }
                body {
                  font-family: "Courier New", monospace;
                  font-size: 9px;
                  margin: 0;
                  white-space: pre-wrap;
                  word-wrap: break-word;
                }
              </style>
            </head>
            <body><pre>$escaped</pre></body>
            </html>
        """.trimIndent()
    }

    private fun requestRuntimePermissions(onGranted: () -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            onGranted()
            return
        }

        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.BLUETOOTH_SCAN)
        }
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }

        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(activity, needed.toTypedArray(), PERMISSION_REQUEST)
        }
        onGranted()
    }
}
