<script setup lang="ts">
import { ref } from 'vue'
import { random_id, storage_ref } from '../lib'
import { NButton, NInput, NInputNumber, NCheckbox, NUpload }  from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'

// const notification = useNotification()

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
const ws_port = ref('3001')
const info = ref('')
const record_file = ref('')
const video_file = ref('')
const video_file_url = ref('')
const group_id = storage_ref('group_id', '')
const user_id = storage_ref('user_id', '')
const isRecording = ref(false)
const blob_url = ref('')
const image_text = ref('')
const image_file = ref<File | null>(null)
const image_files = ref<File[]>([])
const is_merge_forward = ref(false)
const delete_after_seconds = ref(0)
const response_info = ref()
const login_info = ref()
// const message_list = ref([] as any[])

let mediaRecorder: MediaRecorder;
let audioBlob: Blob;

async function onebot_call (action = 'send_group_msg', params: any) : Promise<any> {
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
    response_info.value = JSON.parse(info.value)

    return response_info.value
  } catch (error) {
    info.value = (error as any).toString()
  }
}

async function send_group_record (file: any) {
  return onebot_call('send_group_msg', {
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

async function send_group_video (file: any) {
  if (is_merge_forward.value) {
    const content = [{ "type": "video", "data": { "file": file } }]
    const messages = [{ "type": "node", "data": {
      "user_id": random_id().toString(),
      "nickname": "QQ 用户",
      "content": content
    } }]
    return onebot_call('send_forward_msg', {
      message_type: 'group',
      group_id: group_id.value,
      message: messages
    })
  } else {
    return onebot_call('send_group_msg', {
      group_id: group_id.value,
      message: [{ "type": "video", "data": { "file": file } }]
    })
  }
}

async function send_group_video_url (url: string) {
  return onebot_call('send_group_msg', {
    group_id: group_id.value,
    message: [{ "type": "video", "data": { "file": url } }]
  })
}

async function send_group_image (dataurl: string[]) {
  let messages = []
  if (is_merge_forward.value) {
    const content = []
    if (image_text.value) {
      content.push({ "type": "text", "data": { "text": image_text.value } })
    }
    dataurl.forEach(url => {
      content.push({ "type": "image", "data": { "file": url } })
    })
    messages = [{ "type": "node", "data": {
      "user_id": random_id().toString(),
      "nickname": "QQ 用户",
      "content": content
    } }]

    return onebot_call('send_forward_msg', {
      message_type: 'group',
      group_id: group_id.value,
      message: messages
    })
  } else {
    messages = dataurl.map(url => ({ "type": "image", "data": { "file": url } }))

    return onebot_call('send_group_msg', {
      group_id: group_id.value,
      message: messages
    })
  }
}

async function send_user_record (file: any) {
  return send_private_msg(file)
}

async function send_private_msg (file: any) {
  return onebot_call('send_msg', {
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
    stream.getTracks().forEach(track => track.stop())
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
  return send_group_record(dataurl)
}

async function send_record_to_user () {
  const dataurl = await blob_to_dataurl(audioBlob)
  return send_private_msg(dataurl)
}

async function blob_to_dataurl (blob: Blob | File[]) : Promise<string[]> {
  const blob_list = blob instanceof Array ? blob : [blob]
  const dataurl_list = await Promise.all(blob_list.map(async (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }))

  return dataurl_list as string[]
}

// function dataurl_to_base64url (dataurl: string) {
//   console.log(dataurl.slice(0, 100))
//   return dataurl.replace(/^data:\w+\/\w+;base64,/, 'base64://')
// }

function onFileChange (options: { fileList: UploadFileInfo[] }) {
  if (options.fileList && options.fileList.length > 0) {
    image_file.value = options.fileList[0].file!
    image_files.value = options.fileList.map(file => file.file!)
  }
}

async function send_image_to_group () {
  if (image_files.value.length > 0) {
    const dataurl = await blob_to_dataurl(image_files.value)
    const result = await send_group_image(dataurl)
    if (result.data.message_id && delete_after_seconds.value > 0) {
      let message_id = result.data.message_id
      setTimeout(() => {
        delete_message(message_id)
      }, delete_after_seconds.value * 1000)
    }
  }
}

async function delete_message (message_id: number) {
  return onebot_call('delete_msg', { message_id })
}

onebot_call('get_login_info', {}).then(() => {
  login_info.value = response_info.value
})

// function start_event () {
//   const ws = new WebSocket(`ws://${http_host.value}:${ws_port.value}/event`)
//   ws.onmessage = (event) => {
//     const data = JSON.parse(event.data)

//     if (data.post_type === 'message') {
//       message_list.value.push(data)

//     if (message_list.value.length > 50) {
//       message_list.value.shift()
//     }

//     const { message } = data
//     const duration = 5000
//     const title = `【${data.group_id}】${data.sender.nickname}`

//     if (message[0].type === 'text') {
//       notification.info({
//         title,
//         content: message[0].data.text,
//         duration
//       })
//     } else if (message[0].type === 'image') {
//       notification.info({
//         title,
//         content: () => h('a', { href: message[0].data.url, target: '_blank', rel: 'noreferrer' }, '图片'),
//         duration
//         })
//       }
//     }
//   }

//   onUnmounted(() => {
//     ws.close()
//   })
// }

// function print_message_concat () {
//   const message_concat = message_list.value
//   .filter(data => data.message[0].type === 'text' && data.group_id === group_id.value)
//   .slice(0, 10)
//   .map(data => `* ${data.sender.nickname}: ${data.message[0].data.text}\n`).join('')
//   console.log(message_concat)
// }

// console.log(start_event, print_message_concat)

// (window as any).print_message_concat = print_message_concat

// start_event()
</script>

<template>
  <h1>Qcat</h1>
  <h2>兼容 <a href="https://napcat.napneko.icu/" target="_blank">NapCatQQ</a></h2>
  <h3 v-if="login_info && login_info.data">欢迎 {{ login_info.data.nickname }}</h3>
  <div class="row">
    <NInput v-model:value="http_port" placeholder="HTTP 服务端口" />
    <NInput v-model:value="ws_port" placeholder="WebSocket 正向服务端口" />
  </div>
  <div class="row">
    <NInput v-model:value="group_id" placeholder="QQ 群号" />
    <NInput v-model:value="user_id" placeholder="QQ 用户号" />
  </div>

  <div class="row">
    <NInput v-model:value="record_file" placeholder="音频文件本地路径" />
    <NButton ghost type="primary" @click="send_group_record(record_file)">发送音频文件到群</NButton>
    <NButton ghost type="info" @click="send_user_record(record_file)">发送音频文件到用户</NButton>
  </div>

  <div class="row">
    <NInput v-model:value="video_file" placeholder="视频文件本地路径" />
    <NButton ghost type="primary" @click="send_group_video(video_file)">发送视频文件到群</NButton>
  </div>

  <div class="row">
    <NInput v-model:value="video_file_url" placeholder="视频文件远程路径" />
    <NButton ghost type="primary" @click="send_group_video_url(video_file_url)">发送视频到群</NButton>
  </div>

  <div class="row">
    <NButton ghost type="error" @click="send_record()" v-if="!isRecording">开始录音</NButton>
    <NButton ghost type="warning" @click="stopRecording()" v-if="isRecording">停止录音</NButton>
    <audio :src="blob_url" controls v-if="blob_url"></audio>
    <NButton ghost type="primary" @click="send_record_to_group()" v-if="blob_url">发送到群</NButton>
    <NButton ghost type="info" @click="send_record_to_user()" v-if="blob_url">发送到用户</NButton>
  </div>

  <div class="row">
    <NUpload @change="onFileChange" list-type="image-card" :max="5">
      <NButton ghost type="primary">上传图片</NButton>
    </NUpload>
    <!-- <input type="text" v-model="image_text" placeholder="涩图描述"> -->

  </div>

  <div class="row">
    <NCheckbox v-model:checked="is_merge_forward"> 合并转发</NCheckbox>
    <NInputNumber v-model:value="delete_after_seconds" :min="0" :max="59" :show-button="false" style="width: 70px;" /> 秒后自动撤回
    <NButton ghost type="primary" @click="send_image_to_group()">发送涩图到群</NButton>
  </div>

  <p>
    {{ info }}
  </p>

  <div class="row">
    <button v-if="response_info && response_info.data && response_info.data.message_id" @click="delete_message(response_info.data.message_id)">撤回消息</button>
  </div>
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
