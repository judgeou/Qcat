<script setup lang="ts">
import { ref } from 'vue'
import { random_id, storage_ref } from '../lib'

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
const group_id = storage_ref('group_id', '')
const user_id = storage_ref('user_id', '')
const isRecording = ref(false)
const blob_url = ref('')
const image_text = ref('')
const image_file = ref<File | null>(null)
const is_merge_forward = ref(false)
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

async function send_group_image (dataurl: string) {
  let messages = []
  if (is_merge_forward.value) {
    const content = []
    if (image_text.value) {
      content.push({ "type": "text", "data": { "text": image_text.value } })
    }
    content.push({ "type": "image", "data": { "file": dataurl } })
    messages = [{ "type": "node", "data": {
      "user_id": random_id().toString(),
      "nickname": "QQ 用户",
      "content": content
    } }]

    await onebot_call('send_forward_msg', {
      group_id: group_id.value,
      message: messages
    })
  } else {
    messages = [{ "type": "image", "data": { "file": dataurl } }]

    await onebot_call('send_group_msg', {
      group_id: group_id.value,
      message: messages
    })
  }
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

async function blob_to_dataurl (blob: Blob | File) : Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function onFileChange (event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (files && files.length > 0) {
    image_file.value = files[0]
  }
}

async function send_image_to_group () {
  if (image_file.value) {
    const dataurl = await blob_to_dataurl(image_file.value)
    await send_group_image(dataurl)
  }
}
</script>

<template>
  <h1>Qcat</h1>
  <h2>兼容 <a href="https://napcat.napneko.icu/" target="_blank">NapCatQQ</a></h2>
  <div class="row">
    <input type="text" v-model="http_port" placeholder="HTTP 服务端口">
  </div>
  <div class="row">
    <input type="text" v-model="group_id" placeholder="QQ 群号">
    <input type="text" v-model="user_id" placeholder="QQ 用户号">
  </div>

  <div class="row">
    <input type="text" v-model="record_file" placeholder="音频文件本地路径">
    <button @click="send_group_record(record_file)">发送音频文件到群</button>
    <button @click="send_user_record(record_file)">发送音频文件到用户</button>
  </div>

  <div class="row">
    <button @click="send_record()" v-if="!isRecording">开始录音</button>
    <button @click="stopRecording()" v-if="isRecording">停止录音</button>
    <audio :src="blob_url" controls v-if="blob_url"></audio>
    <button v-if="blob_url" @click="send_record_to_group()">发送到群</button>
    <button v-if="blob_url" @click="send_record_to_user()">发送到用户</button>
  </div>

  <div class="row">
    <input type="file" @change="onFileChange">
    <!-- <input type="text" v-model="image_text" placeholder="涩图描述"> -->
    <input type="checkbox" v-model="is_merge_forward"> 合并转发
    <button @click="send_image_to_group()">发送涩图到群</button>
  </div>

  <p>
    {{ info }}
  </p>
</template>

<style scoped>
.row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}
input[type="checkbox"] {
  width: 16px;
  height: 16px;
}
</style>
