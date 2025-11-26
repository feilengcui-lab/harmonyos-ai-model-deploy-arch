// 路径：entry/ets/entryability/EntryAbility.ets
import Ability from '@ohos.app.ability.Ability';
import Window from '@ohos.app.ability.Window';
import logger from '@ohos.logger';

// 日志工具（可选，用于调试输出）
const TAG = 'EntryAbility';
const logger = logger.getLogger(TAG);

export default class EntryAbility extends Ability {
  // 1. 应用创建时触发（仅执行一次）
  onCreate(want, launchParam) {
    logger.info(TAG, '应用创建：onCreate');
    // 可在此初始化全局资源（如配置项、全局变量，无需初始化模型，模型在页面加载时初始化）
  }

  // 2. 应用窗口创建时触发（加载页面）
  async onWindowStageCreate(windowStage: Window.WindowStage) {
    logger.info(TAG, '窗口创建：onWindowStageCreate');

    // 设置主页面（必须与 module.json5 中 "pages" 配置的首个页面一致）
    await windowStage.loadContent('pages/Index', (err, data) => {
      if (err) {
        logger.error(TAG, `加载页面失败：${JSON.stringify(err)}`);
        return;
      }
      logger.info(TAG, `页面加载成功：${JSON.stringify(data)}`);
    });

    // 显示窗口（必需，否则应用黑屏）
    windowStage.getMainWindow().then((mainWindow) => {
      mainWindow.show().then(() => {
        logger.info(TAG, '应用窗口显示成功');
      }).catch((err) => {
        logger.error(TAG, `窗口显示失败：${JSON.stringify(err)}`);
      });
    });
  }

  // 3. 应用窗口销毁时触发
  onWindowStageDestroy() {
    logger.info(TAG, '窗口销毁：onWindowStageDestroy');
    // 可在此释放窗口相关资源
  }

  // 4. 应用切换到前台时触发（如从后台切回）
  onForeground() {
    logger.info(TAG, '应用切换到前台：onForeground');
  }

  // 5. 应用切换到后台时触发（如按Home键）
  onBackground() {
    logger.info(TAG, '应用切换到后台：onBackground');
    // 可在此暂停非必要任务（如推理、网络请求）
  }

  // 6. 应用销毁时触发（如用户手动关闭应用）
  onDestroy() {
    logger.info(TAG, '应用销毁：onDestroy');
    // 可在此释放全局资源（如模型、文件句柄）
  }
}
