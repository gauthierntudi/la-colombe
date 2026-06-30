# Yoco Payment SDK — https://developer.yoco.com/sdks/payment-sdk/android/installation
-keep class com.google.android.material.** { *; }

-keep @kotlinx.serialization.Serializable class *

-keep class com.birbit.android.jobqueue.** { *; }
-dontwarn com.birbit.android.jobqueue.scheduling.Gcm*

-dontwarn com.google.android.material.**
-dontnote com.google.android.material.**

-keep class com.yoco.ono.common.miura.** { *; }
-keep class com.yoco.ono.android.miura.** { *; }
-keep class com.yoco.ono.common.dspread.** { *; }
-keep class com.yoco.ono.android.dspread.** { *; }
-keep class com.yoco.ono.common.datecs.** { *; }
-keep class com.yoco.ono.android.datecs.** { *; }
-keep class com.yoco.ono.common.bluetooth.** { *; }
-keep class com.yoco.ono.android.bluetooth.** { *; }
-keep class com.yoco.ono.common.cloud.** { *; }
-keep class com.yoco.ono.android.cloud.** { *; }
-keep class com.yoco.ono.common.modules.sdk.models.** { *; }
-keep class com.yoco.ono.android.modules.** { *; }

-keep class com.yoco.payments.sdk.** { *; }
