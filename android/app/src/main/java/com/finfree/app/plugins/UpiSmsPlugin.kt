package com.finfree.app.plugins

import android.Manifest
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "UpiSms",
    permissions = [
        Permission(
            strings = [Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS],
            alias = "sms"
        )
    ]
)
class UpiSmsPlugin : Plugin() {

    private var receiver: SmsBroadcastReceiver? = null

    companion object {
        val UPI_SENDERS = listOf(
            "HDFCBK", "SBIINB", "ICICIB", "AXISBK", "IOBSMS",
            "PAYTM", "GPAY", "PHONEPE", "AMAZONPAY", "KOTAKB",
            "YESBNK", "INDBNK", "BOIIND", "PNBSMS", "CANBNK",
            "UCOBNK", "IDFCFB", "FEDERAL", "AUBANK", "JUPITRMONEY"
        )
    }

    override fun load() {
        super.load()
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        if (getPermissionState("sms") != "granted") {
            call.reject("SMS permission not granted")
            return
        }

        if (receiver != null) {
            call.resolve(JSObject().put("status", "already_listening"))
            return
        }

        receiver = SmsBroadcastReceiver { sender, body, timestamp ->
            val data = JSObject()
            data.put("sender", sender)
            data.put("body", body)
            data.put("timestamp", timestamp)
            notifyListeners("smsReceived", data)
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = 999
        activity.registerReceiver(receiver, filter)

        call.resolve(JSObject().put("status", "listening"))
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        receiver?.let {
            activity.unregisterReceiver(it)
            receiver = null
        }
        call.resolve(JSObject().put("status", "stopped"))
    }

    @PluginMethod
    fun readSmsHistory(call: PluginCall) {
        if (getPermissionState("sms") != "granted") {
            call.reject("SMS permission not granted")
            return
        }

        val days = call.getInt("days", 90) ?: 90
        val cutoff = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)

        val messages = JSArray()
        val uri = Uri.parse("content://sms/inbox")
        val projection = arrayOf("address", "body", "date")
        val selection = "date > ?"
        val selectionArgs = arrayOf(cutoff.toString())
        val sortOrder = "date DESC"

        var cursor: Cursor? = null
        try {
            cursor = activity.contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
            cursor?.let {
                val addressIdx = it.getColumnIndexOrThrow("address")
                val bodyIdx = it.getColumnIndexOrThrow("body")
                val dateIdx = it.getColumnIndexOrThrow("date")

                while (it.moveToNext()) {
                    val address = it.getString(addressIdx) ?: continue
                    val body = it.getString(bodyIdx) ?: continue
                    val date = it.getLong(dateIdx)

                    val upperAddr = address.uppercase()
                    val isUpi = UPI_SENDERS.any { sender -> upperAddr.contains(sender) }
                    if (!isUpi) continue

                    val hasUpiKeyword = body.contains("UPI", ignoreCase = true) ||
                            body.contains("UTR", ignoreCase = true) ||
                            body.contains("debited", ignoreCase = true) ||
                            body.contains("credited", ignoreCase = true) ||
                            body.contains("sent Rs", ignoreCase = true) ||
                            body.contains("received Rs", ignoreCase = true)
                    if (!hasUpiKeyword) continue

                    val msg = JSObject()
                    msg.put("sender", address)
                    msg.put("body", body)
                    msg.put("timestamp", date)
                    messages.put(msg)
                }
            }
        } finally {
            cursor?.close()
        }

        val result = JSObject()
        result.put("messages", messages)
        result.put("count", messages.length())
        call.resolve(result)
    }

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val state = getPermissionState("sms")
        val result = JSObject()
        result.put("sms", state ?: "prompt")
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        requestPermissionForAlias("sms", call, "smsPermissionCallback")
    }

    @PermissionCallback
    private fun smsPermissionCallback(call: PluginCall) {
        val state = getPermissionState("sms")
        val result = JSObject()
        result.put("sms", state ?: "denied")
        call.resolve(result)
    }

    override fun handleOnDestroy() {
        receiver?.let {
            try { activity.unregisterReceiver(it) } catch (_: Exception) {}
            receiver = null
        }
        super.handleOnDestroy()
    }
}
