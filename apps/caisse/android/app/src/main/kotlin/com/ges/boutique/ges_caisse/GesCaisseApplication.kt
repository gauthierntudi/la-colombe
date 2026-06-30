package com.ges.boutique.ges_caisse

import android.app.Application
import com.yoco.payments.sdk.YocoSDK

class GesCaisseApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        YocoSDK.initialise(applicationContext)
    }
}
