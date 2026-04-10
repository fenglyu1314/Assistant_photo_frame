## Requirements

### 需求:量化参数数据模型

桌面端必须定义 `QuantizationParams` 接口，包含以下字段及默认值：

| 字段 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `saturationFactor` | `number` | `1.4` | `[0.5, 3.0]` | 饱和度增强系数 |
| `ditherThreshold` | `number` | `24000` | `[0, 50000]` | Floyd-Steinberg 抖动阈值保护（RGB 距离平方） |
| `graySpread` | `number` | `40` | `[0, 100]` | 灰色判定通道极差阈值 |
| `grayLuminanceMidpoint` | `number` | `128` | `[50, 200]` | 灰色二值化亮度中点 |

该接口必须导出自独立模块 `companion/src/core/quantization-params.ts`。

#### 场景:默认参数对象

- **WHEN** 调用 `getDefaultParams()` 函数
- **THEN** 返回的对象必须包含上述 4 个字段及其默认值

#### 场景:参数类型安全

- **WHEN** TypeScript 代码使用 `QuantizationParams` 接口
- **THEN** 所有 4 个字段必须为必填（非可选），类型为 `number`

### 需求:参数验证

桌面端必须提供 `validateParams(params: Partial<QuantizationParams>): QuantizationParams` 函数，将用户输入的参数 clamp 到有效范围内。

#### 场景:超出范围的值被钳制

- **WHEN** 传入 `{ saturationFactor: 5.0 }`
- **THEN** 返回值中 `saturationFactor` 必须为 `3.0`（范围上限），其余字段使用默认值

#### 场景:部分参数合并默认值

- **WHEN** 传入 `{ ditherThreshold: 10000 }`
- **THEN** 返回值中 `ditherThreshold` 为 `10000`，其余 3 个字段为默认值

#### 场景:空输入返回全部默认值

- **WHEN** 传入 `{}`
- **THEN** 返回值等于 `getDefaultParams()` 的结果

### 需求:参数持等性

量化参数模块必须导出 `DEFAULT_QUANTIZATION_PARAMS` 常量对象（冻结），确保默认值不可被意外修改。

#### 场景:默认值不可变

- **WHEN** 尝试修改 `DEFAULT_QUANTIZATION_PARAMS.saturationFactor`
- **THEN** 操作失败或无效果（Object.freeze）
