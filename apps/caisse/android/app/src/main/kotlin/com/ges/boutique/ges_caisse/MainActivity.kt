package com.ges.boutique.ges_caisse

import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL = "com.ges.boutique/yoco_print"
        private const val TAG = "MainActivity"
    }

    private lateinit var yocoPrintHelper: YocoPrintHelper

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        yocoPrintHelper = YocoPrintHelper(this)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "configure" -> {
                        val secret = call.argument<String>("secret") ?: ""
                        val sandbox = call.argument<Boolean>("sandbox") ?: false
                        yocoPrintHelper.configure(secret, sandbox) { ok, error ->
                            if (ok) result.success(true)
                            else result.error("YOCO_CONFIG", error, null)
                        }
                    }
                    "printReceipt" -> {
                        val text = call.argument<String>("text") ?: ""
                        val jobName = call.argument<String>("jobName") ?: "Bon de sortie"
                        yocoPrintHelper.printReceipt(text, jobName) { ok, error ->
                            if (ok) result.success(true)
                            else result.error("YOCO_PRINT", error, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
