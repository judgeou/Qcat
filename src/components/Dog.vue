<script setup lang="ts">
import { ref } from 'vue'

const media_constraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 2, // Stereo
    sampleRate: 48000, // CD-quality audio
    sampleSize: 24 // 16-bit audio
  }
}
const format_codec = 'audio/webm'

const http_host = ref('127.0.0.1')
const http_port = ref('3000')
const info = ref('')
const record_file = ref('')
const group_id = ref('')
const user_id = ref('')
const isRecording = ref(false)
const blob_url = ref('')

let mediaRecorder: MediaRecorder;
let audioBlob: Blob;

async function onebot_call (action = 'send_group_msg', params: any) {
  info.value = 'sending...'
  try {
    const response = await fetch(`http://${http_host.value}:${http_port.value}/${action}`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    info.value = await response.text()
  } catch (error) {
    info.value = (error as any).toString()
  }
}

async function send_group_record (file: any) {
  await onebot_call('send_group_msg', {
    group_id: group_id.value,
    message: [
      {
          "type": "record",
          "data": {
              "file": file
          }
      }
    ]
  })
}

async function send_user_record (file: any) {
  await send_private_msg(file)
}

async function send_private_msg (file: any) {
  await onebot_call('send_msg', {
    user_id: user_id.value,
    message_type: 'private',
    message: [{ "type": "record", "data": { "file": file } }]
  })
}

async function send_record () {
  isRecording.value = true
  let audioChunks = [] as Blob[];

  const stream = await navigator.mediaDevices.getUserMedia(media_constraints);
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: format_codec,
    audioBitsPerSecond: 64000
  });

  mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
          audioChunks.push(event.data);
      }
  };

  mediaRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: format_codec });
    audioChunks = [];

    if (blob_url.value) {
      URL.revokeObjectURL(blob_url.value)
    }
    blob_url.value = URL.createObjectURL(audioBlob)
  }

  mediaRecorder.start();
  info.value = ('Recording started');
}

async function stopRecording () {
  isRecording.value = false

  mediaRecorder.stop();
}

async function send_record_to_group () {
  const dataurl = await blob_to_dataurl(audioBlob)
  await send_group_record(dataurl)
}

async function send_record_to_user () {
  const dataurl = await blob_to_dataurl(audioBlob)
  await send_private_msg(dataurl)
}

async function blob_to_dataurl (blob: Blob) : Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
</script>

<template>
  <h1>Hello</h1>
  <div>
    <input type="text" v-model="http_port" placeholder="HTTP 服务端口">
  </div>
  <div>
    <input type="text" v-model="group_id" placeholder="QQ 群号">
    <input type="text" v-model="user_id" placeholder="QQ 用户号">
    <input type="text" v-model="record_file" placeholder="音频文件本地路径">
  </div>

  <div>
    <!-- <button @click="send_group_msg_text('你好')">send_group_msg_text</button> -->
    <button @click="send_group_record(record_file)">发送音频文件到群</button>
    <button @click="send_user_record(record_file)">发送音频文件到用户</button>
  </div>

  <div>
    <button @click="send_record()" v-if="!isRecording">开始录音</button>
    <button @click="stopRecording()" v-if="isRecording">停止录音</button>
    <audio :src="blob_url" controls v-if="blob_url"></audio>
    <button v-if="blob_url" @click="send_record_to_group()">发送到群</button>
    <button v-if="blob_url" @click="send_record_to_user()">发送到用户</button>
  </div>


  <p>
    {{ info }}
  </p>
</template>

<style scoped>

</style>
