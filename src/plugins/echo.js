import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Đảm bảo bạn có các biến môi trường này trong .env.local của Vue project
// Ví dụ: VITE_REVERB_APP_KEY, VITE_REVERB_HOST, VITE_REVERB_PORT, VITE_REVERB_SCHEME
const REVERB_APP_KEY = 'whurq5vuh8embqvauf0w'
const REVERB_HOST = 'localhost'
const REVERB_PORT = 8080
const REVERB_SCHEME = 'http'

// Gán Pusher vào Window để Echo có thể tìm thấy
window.Pusher = Pusher

const EchoInstance = new Echo({
  broadcaster: 'reverb',
  key: REVERB_APP_KEY,
  wsHost: REVERB_HOST,
  wsPort: REVERB_PORT,
  wssPort: REVERB_PORT,
  forceTLS: REVERB_SCHEME === 'https',
  disableStats: true, // Tắt thống kê nếu không cần
  enabledTransports: ['ws', 'wss'], // Chỉ định các transport được phép
  // authEndpoint và auth.headers chỉ cần thiết nếu bạn sử dụng PrivateChannel hoặc PresenceChannel
  // authEndpoint: `http://${REVERB_HOST}:8000/api/broadcasting/auth`, // Thay bằng URL xác thực Laravel của bạn
  // auth: {
  //     headers: {
  //         Authorization: `Bearer YOUR_JWT_TOKEN_HERE`, // Thay bằng JWT token của người dùng
  //     },
  // },
})

export default EchoInstance
