package com.finfree.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.finfree.app.plugins.UpiSmsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpiSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
