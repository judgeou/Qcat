import { ref, watch } from 'vue'

function storage_ref <T> (key: string, default_value: T) {
  const value = localStorage.getItem(`QCAT_WEBAPP_${key}`)
  const value_ref = ref(value ? JSON.parse(value) as T : default_value)
  watch(value_ref, (new_value) => {
    localStorage.setItem(`QCAT_WEBAPP_${key}`, JSON.stringify(new_value))
  })
  return value_ref
}

function random_id (min = 100000000, max = 900000000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export { 
  random_id,
  storage_ref
}
