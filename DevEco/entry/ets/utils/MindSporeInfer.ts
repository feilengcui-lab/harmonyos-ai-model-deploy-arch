import mindsporeLite from '@ohos/mindspore-lite';
import image from '@ohos.multimedia.image';
import util from '@ohos.util';

// ====================== 配置参数（用户按需修改） ======================
const MODEL_PATH = '/models/your_model.mindir';  // 模型相对路径（需放在main_pages/models下）
const INPUT_SHAPE = [1, 3, 224, 224];  // 与导出时一致：[batch, channel, h, w]
const INPUT_MEAN = 127.5;  // 预处理均值（与训练时一致）
const INPUT_STD = 127.5;   // 预处理标准差（与训练时一致）
const NUM_CLASSES = 10;    // 类别数（与模型一致）

// 示例类别名称（用户替换为自己的类别）
const CLASS_NAMES = [
  "类别0", "类别1", "类别2", "类别3", "类别4",
  "类别5", "类别6", "类别7", "类别8", "类别9"
];

export class MindSporeInfer {
  private model: mindsporeLite.Model | null = null;
  private isInit = false;

  // 1. 初始化模型（加载MINDIR模型）
  async initModel(): Promise<boolean> {
    try {
      // 1. 创建MindSpore Lite环境
      const context = new mindsporeLite.Context();
      context.target = [mindsporeLite.DeviceType.CPU];  // 端侧CPU推理（支持GPU/NPU需额外配置）
      context.cpu = {
        numThreads: 4,  // CPU线程数
        precisionMode: mindsporeLite.PrecisionMode.HIGH
      };

      // 2. 加载模型文件
      const modelBuffer = await this.loadModelFile(MODEL_PATH);
      const model = new mindsporeLite.Model();
      const loadConfig = new mindsporeLite.ModelLoadConfig();
      const loadResult = await model.load(modelBuffer, context, loadConfig);

      if (loadResult !== mindsporeLite.ResultCode.SUCCESS) {
        console.error(`模型加载失败！错误码：${loadResult}`);
        return false;
      }

      this.model = model;
      this.isInit = true;
      console.log("模型初始化成功");
      return true;
    } catch (e) {
      console.error(`模型初始化异常：${JSON.stringify(e)}`);
      return false;
    }
  }

  // 2. 读取模型文件（从应用资源目录加载）
  private async loadModelFile(path: string): Promise<ArrayBuffer> {
    const file = await fileio.open(path, fileio.OpenMode.READ_ONLY);
    const fileStat = await fileio.fstat(file.fd);
    const buffer = new ArrayBuffer(fileStat.size);
    await fileio.read(file.fd, buffer);
    await fileio.close(file.fd);
    return buffer;
  }

  // 3. 图像预处理（用户按需修改：与训练时一致）
  // 输入：原始图片像素数据，输出：模型输入张量（NCHW格式，归一化后）
  private preprocessImage(pixelBuffer: ArrayBuffer, imageWidth: number, imageHeight: number): Float32Array {
    const [batch, channel, inputH, inputW] = INPUT_SHAPE;
    const inputSize = batch * channel * inputH * inputW;
    const inputTensor = new Float32Array(inputSize);

    // 步骤1：将图片缩放到224x224（简单双线性插值，可替换为更优算法）
    const scaledPixels = this.resizeImage(pixelBuffer, imageWidth, imageHeight, inputW, inputH);

    // 步骤2：归一化（(pixel - mean) / std）+ 转NCHW格式
    let idx = 0;
    for (let c = 0; c < channel; c++) {  // 通道：R→G→B
      for (let h = 0; h < inputH; h++) {
        for (let w = 0; w < inputW; w++) {
          const pixelIdx = h * inputW * 4 + w * 4 + c;  // RGBA格式，取前3通道
          const pixel = scaledPixels[pixelIdx] / 255.0;  // 0-1归一化
          inputTensor[idx] = (pixel - INPUT_MEAN / 255.0) / (INPUT_STD / 255.0);
          idx++;
        }
      }
    }

    return inputTensor;
  }

  // 辅助：图像缩放（双线性插值，适配RGBA格式）
  private resizeImage(pixelBuffer: ArrayBuffer, srcW: number, srcH: number, dstW: number, dstH: number): Uint8Array {
    const srcPixels = new Uint8Array(pixelBuffer);
    const dstPixels = new Uint8Array(dstW * dstH * 4);  // RGBA格式

    const scaleX = srcW / dstW;
    const scaleY = srcH / dstH;

    for (let dstY = 0; dstY < dstH; dstY++) {
      for (let dstX = 0; dstX < dstW; dstX++) {
        // 计算源图像坐标
        const srcX = dstX * scaleX;
        const srcY = dstY * scaleY;
        const srcX0 = Math.floor(srcX);
        const srcX1 = Math.min(srcX0 + 1, srcW - 1);
        const srcY0 = Math.floor(srcY);
        const srcY1 = Math.min(srcY0 + 1, srcH - 1);

        // 双线性插值权重
        const wx = srcX - srcX0;
        const wy = srcY - srcY0;

        // 四个邻域像素索引
        const idx00 = (srcY0 * srcW + srcX0) * 4;
        const idx01 = (srcY0 * srcW + srcX1) * 4;
        const idx10 = (srcY1 * srcW + srcX0) * 4;
        const idx11 = (srcY1 * srcW + srcX1) * 4;

        // 插值计算RGBA通道
        for (let ch = 0; ch < 4; ch++) {
          const pixel = (1 - wx) * (1 - wy) * srcPixels[idx00 + ch] +
                        wx * (1 - wy) * srcPixels[idx01 + ch] +
                        (1 - wx) * wy * srcPixels[idx10 + ch] +
                        wx * wy * srcPixels[idx11 + ch];
          dstPixels[(dstY * dstW + dstX) * 4 + ch] = Math.round(pixel);
        }
      }
    }

    return dstPixels;
  }

  // 4. 模型推理（核心方法）
  async infer(image: image.Image): Promise<string> {
    if (!this.isInit || !this.model) {
      throw new Error("模型未初始化");
    }

    try {
      // 步骤1：获取图片像素数据（RGBA格式）
      const imageInfo = await image.getImageInfo();
      const pixelMap = await image.createPixelMap();
      const pixelBuffer = await pixelMap.readPixelsToBuffer();
      pixelMap.release();

      // 步骤2：预处理（缩放到输入尺寸+归一化+转NCHW）
      const inputTensor = this.preprocessImage(pixelBuffer, imageInfo.size.width, imageInfo.size.height);

      // 步骤3：设置模型输入
      const inputs = this.model.getInputs();
      if (inputs.length === 0) {
        throw new Error("获取模型输入失败");
      }
      inputs[0].setData(inputTensor.buffer as ArrayBuffer);

      // 步骤4：执行推理
      const inferResult = await this.model.predict();
      if (inferResult !== mindsporeLite.ResultCode.SUCCESS) {
        throw new Error(`推理失败！错误码：${inferResult}`);
      }

      // 步骤5：后处理（解析输出，用户按需修改）
      const outputs = this.model.getOutputs();
      const outputData = new Float32Array(outputs[0].getData());
      const predictIdx = this.argmax(outputData);  // 取概率最大的类别
      return CLASS_NAMES[predictIdx] || `未知类别(${predictIdx})`;
    } catch (e) {
      console.error(`推理异常：${JSON.stringify(e)}`);
      throw e;
    }
  }

  // 辅助：求数组最大值索引（适用于分类任务）
  private argmax(arr: Float32Array): number {
    let maxVal = arr[0];
    let maxIdx = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > maxVal) {
        maxVal = arr[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  // 5. 释放模型资源
  destroy(): void {
    if (this.model) {
      this.model.free();
      this.model = null;
      this.isInit = false;
      console.log("模型资源已释放");
    }
  }
}
