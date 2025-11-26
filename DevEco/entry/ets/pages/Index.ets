import router from '@ohos.router';
import image from '@ohos.multimedia.image';
import picker from '@ohos.file.picker';
import { MindSporeInfer } from '../utils/MindSporeInfer';

@Entry
@Component
struct Index {
  @State imagePixelMap: PixelMap | null = null;  
  @State predictResult: string = "未推理";       
  @State isLoading: boolean = false;            
  private infer: MindSporeInfer = new MindSporeInfer();  

  // 页面加载时初始化模型
  aboutToAppear() {
    this.initModel();
  }

  // 页面销毁时释放模型
  aboutToDisappear() {
    this.infer.destroy();
  }

  // 初始化模型
  async initModel() {
    this.isLoading = true;
    const success = await this.infer.initModel();
    if (success) {
      this.predictResult = "模型就绪，可选择图片推理";
    } else {
      this.predictResult = "模型初始化失败";
    }
    this.isLoading = false;
  }

  // 选择本地图片
  async pickImage() {
    try {
      // 打开图片选择器
      const photoPicker = new picker.PhotoViewPicker();
      const result = await photoPicker.select();

      if (result.photoUris && result.photoUris.length > 0) {
        const uri = result.photoUris[0];
        // 读取图片为PixelMap（用于显示）
        const imageSource = image.createImageSource(uri);
        const pixelMap = await imageSource.createPixelMap();
        this.imagePixelMap = pixelMap;

        // 执行推理
        this.inferImage(uri);
      }
    } catch (e) {
      console.error(`选择图片失败：${JSON.stringify(e)}`);
      this.predictResult = "选择图片失败";
    }
  }

  // 对选中的图片执行推理
  async inferImage(uri: string) {
    this.isLoading = true;
    this.predictResult = "推理中...";
    try {
      // 从URI创建Image对象（用于推理）
      const imageSource = image.createImageSource(uri);
      const image = await imageSource.createImage();

      // 调用推理工具类
      const result = await this.infer.infer(image);
      this.predictResult = `推理结果：${result}`;
    } catch (e) {
      console.error(`推理失败：${JSON.stringify(e)}`);
      this.predictResult = `推理失败：${e}`;
    } finally {
      this.isLoading = false;
    }
  }

  build() {
    Column({ space: 20 }) {
      // 标题
      Text("昇思模型DevEco部署示例")
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 50 });

      // 加载状态提示
      if (this.isLoading) {
        Progress({ value: 50, type: ProgressType.Circular })
          .width(40)
          .height(40);
      }

      // 图片显示区域
      Stack() {
        if (this.imagePixelMap) {
          Image(this.imagePixelMap)
            .width(300)
            .height(300)
            .objectFit(ImageFit.Contain)
            .border({ width: 1, color: Color.Gray });
        } else {
          Text("未选择图片")
            .width(300)
            .height(300)
            .border({ width: 1, color: Color.Gray })
            .textAlign(TextAlign.Center)
            .lineHeight(300);
        }
      }

      // 选择图片按钮
      Button("选择本地图片")
        .width(200)
        .height(45)
        .backgroundColor(Color.Blue)
        .fontColor(Color.White)
        .onClick(() => this.pickImage())
        .enabled(!this.isLoading);

      // 推理结果显示
      Text(this.predictResult)
        .fontSize(18)
        .margin({ top: 10 });
    }
    .width('100%')
    .alignItems(ItemAlign.Center)
    .padding(20);
  }
}
