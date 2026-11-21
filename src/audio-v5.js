/**
 * scrcpy 5.x（server 5.0.1）+ send_stream_meta=false 的音频流兼容层
 *
 * 背景：
 *  - scrcpy 4.0 起 `send_codec_meta` 改为 `send_stream_meta`，本项目下发 false 兼容旧解码管线；
 *  - 该模式下音频 socket 成功时**没有 codec id 头**，直接是「12 字节帧头 + PCM」：
 *      帧头 = pts_u64(BE) + len_u32(BE)
 *  - 只有采集失败时服务端才写 4 字节信号（0x00000000=disabled / 0x00000001=errored），随后关闭 socket。
 *
 * 坑：PTS 是系统时间（µs 量级，随着开机时长增长），一旦超过 2^32 µs（约 71.6 分钟），
 *     PTS 高 32 位正好等于 0x00000001 —— 与「errored」信号完全撞车。
 *     所以**绝不能**用「前 4 字节 == 0/1」判断失败，只能以「流是否提前结束」为准。
 */

export const V5_AUDIO_HEADER_BYTES = 12;

/**
 * 根据已读到的前缀字节分类（纯函数，便于回归测试）
 * @param {Uint8Array} bytes 已读到的前缀（最多 12 字节）
 * @returns {{type:"data"|"disabled"|"errored"}}
 */
export function classifyV5AudioHead(bytes) {
  if (bytes && bytes.byteLength >= V5_AUDIO_HEADER_BYTES) return { type: "data" };
  if (bytes && bytes.byteLength >= 4) {
    const sig = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    return { type: sig === 0 ? "disabled" : "errored" };
  }
  return { type: "errored" };
}

/**
 * 用给定的 codec 构造 v5 音频元数据解析器（替换客户端库的 parseAudioStreamMetadata）
 * @param {object} codec ScrcpyAudioCodec 实例
 * @param {(pending:Uint8Array, reader:ReadableStreamDefaultReader) => ReadableStream} makeStream
 */
export function createV5AudioMetaParser(codec, makeStream) {
  return async (stream) => {
    const reader = stream.getReader();
    let buf = new Uint8Array(0);
    const append = (value) => {
      const merged = new Uint8Array(buf.byteLength + value.byteLength);
      merged.set(buf);
      merged.set(value, buf.byteLength);
      buf = merged;
    };
    try {
      // 先凑一个完整帧头；凑满即认定为正常音频流，已读字节原样推回
      while (buf.byteLength < V5_AUDIO_HEADER_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        append(value);
      }
      const verdict = classifyV5AudioHead(buf);
      if (verdict.type === "data") {
        return { type: "success", codec, stream: makeStream(buf, reader) };
      }
      return { type: verdict.type };
    } catch {
      return { type: "errored" };
    }
  };
}
