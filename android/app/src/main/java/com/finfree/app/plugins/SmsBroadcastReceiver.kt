package com.finfree.app.plugins

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsBroadcastReceiver(
    private val onSmsReceived: (sender: String, body: String, timestamp: Long) -> Unit
) : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val sender = messages[0].displayOriginatingAddress ?: return
        val upperSender = sender.uppercase()

        val isUpiSender = UpiSmsPlugin.UPI_SENDERS.any { upperSender.contains(it) }
        if (!isUpiSender) return

        val fullBody = messages.joinToString("") { it.displayMessageBody ?: "" }
        if (fullBody.isBlank()) return

        val hasTransactionContent = fullBody.contains("UPI", ignoreCase = true) ||
                fullBody.contains("UTR", ignoreCase = true) ||
                fullBody.contains("debited", ignoreCase = true) ||
                fullBody.contains("credited", ignoreCase = true) ||
                fullBody.contains("sent Rs", ignoreCase = true) ||
                fullBody.contains("received Rs", ignoreCase = true) ||
                fullBody.contains("withdrawn", ignoreCase = true) ||
                fullBody.contains("transferred", ignoreCase = true) ||
                fullBody.contains("payment of", ignoreCase = true) ||
                fullBody.contains("paid to", ignoreCase = true) ||
                fullBody.contains("Txn", ignoreCase = true) ||
                fullBody.contains("transaction", ignoreCase = true) ||
                (fullBody.contains("Rs", ignoreCase = true) && fullBody.contains("A/c", ignoreCase = true))

        if (!hasTransactionContent) return

        onSmsReceived(sender, fullBody, System.currentTimeMillis())
    }
}
