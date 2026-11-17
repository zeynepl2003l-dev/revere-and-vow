package com.rav.alliance;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Receives RAV FCM alerts. Background notifications use the system tray;
 * foreground messages are displayed on the high-importance rav_urgent channel. */
public final class RavMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences("rav_fcm",MODE_PRIVATE)
            .edit().putString("fcm_token",token).apply();
        // The token is associated with a user only after they log in and opt in.
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        RemoteMessage.Notification notification=message.getNotification();
        String text=notification!=null?notification.getBody():message.getData().get("body");
        if(text==null||text.isEmpty())return;
        String title=notification!=null?notification.getTitle():"🚨 RAV Acil Bildirim";
        if(title==null||title.isEmpty())title="🚨 RAV Acil Bildirim";
        Intent open=new Intent(this,MainActivity.class);
        open.putExtra("screen","alerts");
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int pendingFlags=PendingIntent.FLAG_UPDATE_CURRENT;
        if(Build.VERSION.SDK_INT>=23)pendingFlags|=PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending=PendingIntent.getActivity(this,0,open,pendingFlags);
        Notification.Builder b=Build.VERSION.SDK_INT>=26?
           new Notification.Builder(this,"rav_urgent"):new Notification.Builder(this);
        b.setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text))
          .setAutoCancel(true).setSmallIcon(android.R.drawable.ic_dialog_alert)
          .setContentIntent(pending).setWhen(System.currentTimeMillis());
        if(Build.VERSION.SDK_INT<26)b.setDefaults(Notification.DEFAULT_ALL).setPriority(Notification.PRIORITY_HIGH);
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        manager.notify((int)(System.currentTimeMillis()%Integer.MAX_VALUE),b.build());
    }
}
