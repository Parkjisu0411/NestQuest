package app.nestquest.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

/** Save to a user-selected document without broad storage permissions. */
@CapacitorPlugin(name = "NestQuestDocuments")
public class NestQuestDocumentsPlugin extends Plugin {
    private boolean saving;

    private File source(PluginCall call) throws Exception {
        File root = new File(getContext().getCacheDir(), "exports").getCanonicalFile();
        String path = call.getString("path");
        if (path == null) throw new Exception("Missing source");
        File file = new File(getContext().getCacheDir(), path).getCanonicalFile();
        if (!file.getPath().startsWith(root.getPath() + File.separator) || !file.isFile()) {
            throw new Exception("Invalid source");
        }
        return file;
    }

    @PluginMethod
    public void save(PluginCall call) {
        if (saving) { call.reject("A document is already being saved"); return; }
        try {
            source(call);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mimeType", "application/octet-stream"));
            intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "nestquest.nestquest"));
            saving = true;
            startActivityForResult(call, intent, "documentSelected");
        } catch (Exception error) {
            saving = false;
            call.reject("Could not open document picker", error);
        }
    }

    @ActivityCallback
    private void documentSelected(PluginCall call, ActivityResult result) {
        if (call == null) { saving = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            saving = false;
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri destination = result.getData().getData();
        getBridge().execute(() -> {
            try (FileInputStream input = new FileInputStream(source(call));
                 OutputStream output = getContext().getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new Exception("No output stream");
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                output.flush();
            } catch (Exception error) {
                saving = false;
                call.reject("Could not save document; destination may contain an incomplete file", error);
                return;
            }
            saving = false;
            call.resolve(new JSObject().put("saved", true));
        });
    }
}
