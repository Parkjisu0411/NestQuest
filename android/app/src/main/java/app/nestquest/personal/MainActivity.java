package app.nestquest.personal;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NestQuestDocumentsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
