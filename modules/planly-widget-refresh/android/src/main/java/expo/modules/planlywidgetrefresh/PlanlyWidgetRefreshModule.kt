package expo.modules.planlywidgetrefresh

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlanlyWidgetRefreshModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PlanlyWidgetRefresh")

    AsyncFunction("scheduleRefresh") { timestampMs: Double? ->
      scheduleRefresh(timestampMs?.toLong())
    }
  }

  private fun scheduleRefresh(timestampMs: Long?) {
    val widgetProvider = ComponentName(
      context.packageName,
      "${context.packageName}.widget.PlanlyToday",
    )
    val widgetIds = AppWidgetManager.getInstance(context)
      .getAppWidgetIds(widgetProvider)
    val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
      component = widgetProvider
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
    }
    val pendingIntent = PendingIntent.getBroadcast(
      context,
      WIDGET_REFRESH_REQUEST_CODE,
      updateIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    alarmManager.cancel(pendingIntent)
    if (
      timestampMs == null ||
      timestampMs <= System.currentTimeMillis() ||
      widgetIds.isEmpty()
    ) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (alarmManager.canScheduleExactAlarms()) {
        alarmManager.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          timestampMs,
          pendingIntent,
        )
      } else {
        alarmManager.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          timestampMs,
          pendingIntent,
        )
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        timestampMs,
        pendingIntent,
      )
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestampMs, pendingIntent)
    }
  }

  companion object {
    private const val WIDGET_REFRESH_REQUEST_CODE = 4103
  }
}
