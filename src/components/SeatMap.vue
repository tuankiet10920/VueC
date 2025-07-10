<template>
  <div class="username">{{ username }}</div>
  <div class="seat-map-container">
    <h2>Realtime Seat Status</h2>

    <div class="auth-section">
      <template v-if="!currentUserId">
        <h3>Đăng nhập</h3>
        <div class="login-form">
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" v-model="loginEmail" placeholder="Nhập email của bạn" />
          </div>
          <div class="form-group">
            <label for="password">Mật khẩu:</label>
            <input type="password" id="password" v-model="loginPassword" placeholder="Nhập mật khẩu của bạn" />
          </div>
          <button @click="performLogin" class="login-button">
            Đăng nhập
          </button>
        </div>
      </template>
      <template v-else>
        <p>Bạn đã đăng nhập với tên: <strong>{{ username }}</strong></p>
        <button @click="handleLogout" class="logout-button">
          Đăng xuất
        </button>
      </template>
    </div>

    <!-- Chatbot Section -->
    <div class="chatbot-container">
      <h3>Chatbot Hỗ trợ</h3>
      <div class="chat-messages" ref="chatMessagesContainer">
        <div v-for="(msg, index) in messages" :key="index" :class="['message-bubble', msg.sender]">
          <p>{{ msg.text }}</p>
        </div>
      </div>
      <div class="chat-input-area">
        <input type="text" v-model="chatInput" @keyup.enter="sendMessage" placeholder="Nhập tin nhắn của bạn..."
          class="chat-input" />
        <button @click="sendMessage" class="send-button">Gửi</button>
      </div>
    </div>
    <!-- End Chatbot Section -->

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance, nextTick } from 'vue';
import axios from 'axios';

// Lấy instance hiện tại để truy cập các thuộc tính global được expose qua `app.config.globalProperties`
// Đảm bảo bạn đã cấu hình Laravel Echo trong `main.js` hoặc `plugins/echo.js` và expose nó đúng cách.
// Ví dụ trong main.js: `app.config.globalProperties.$echo = Echo;`
const { proxy } = getCurrentInstance();
const $echo = proxy.$echo;

// Khai báo các Ref reactive
const username = ref('Tài khoản khách');
const message = ref('');
const errorMessage = ref('');
const countdownIntervals = {}; // Dùng để lưu trữ các setInterval cho countdown
const currentUserId = ref(null);

// Refs cho form đăng nhập
const loginEmail = ref('');
const loginPassword = ref('');

// Refs và logic cho Chatbot
const chatInput = ref('');
const messages = ref([
  { sender: 'bot', text: 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?' }
]);
const chatMessagesContainer = ref(null); // Ref để cuộn xuống cuối tin nhắn

// Cấu hình các URL API
const API_BASE_URL = 'http://127.0.0.1:8000/api/auth';
const API_URL = 'http://127.0.0.1:8000/api';
const API_HOLD_SEAT_URL = `${API_BASE_URL}/hold-seat`;
const API_ME = `${API_BASE_URL}/me`;
const API_SEATS = `${API_URL}/showtimes/type/1?showtime=1`;
const API_REMOVE_TICKET_BEACON = `${API_BASE_URL}/remove-ticket`;
const API_RELEASE_SEAT_URL = (seatId) => `${API_BASE_URL}/remove-seat/${seatId}`;
const API_LOGIN = `http://127.0.0.1:8000/api/login`;
const API_LOGOUT = `${API_BASE_URL}/logout`;

/**
 * Lấy thông tin người dùng hiện tại từ API.
 */
const me = async () => {
  message.value = '';
  errorMessage.value = '';
  console.log('--- Đang lấy thông tin người dùng (API_ME)... ---');

  try {
    const response = await axios.get(API_ME, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status >= 200 && response.status < 300) {
      username.value = response.data.data.name || 'Người dùng đã đăng nhập';
      currentUserId.value = response.data.data.id;
      message.value = 'Đã tải thông tin người dùng thành công!';
      console.log(`Người dùng hiện tại: ${username.value} (ID: ${currentUserId.value})`);

      // Sau khi có currentUserId, khởi tạo lại countdown cho các ghế đang được giữ
      // (đảm bảo rằng nếu có ghế được giữ bởi người dùng hiện tại, countdown sẽ chạy)
      // seatsData.value.forEach(seat => { // seatsData is not defined in this snippet, commenting out
      //   if (seat.status === 'held' && seat.heldUntil) {
      //     // Chỉ khởi động lại countdown nếu ghế đang được giữ và có thời gian hết hạn
      //     startCountdown(seat.id, seat.heldUntil);
      //   }
      // });
      console.log('--- Lấy thông tin người dùng hoàn tất. ---');
    } else {
      errorMessage.value = 'Phản hồi không mong muốn từ server khi lấy thông tin người dùng.';
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      errorMessage.value = 'Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
      username.value = 'Tài khoản khách';
      currentUserId.value = null;
      console.log('Người dùng chưa đăng nhập hoặc token hết hạn.');
    } else {
      errorMessage.value = error.response?.data?.message || 'Lỗi từ server khi lấy thông tin người dùng.';
    }
    console.error('Lỗi API /me:', error);
  }
};

/**
 * Xử lý đăng nhập người dùng.
 */
const performLogin = async () => {
  const email = loginEmail.value;
  const password = loginPassword.value;

  message.value = '';
  errorMessage.value = '';

  if (!email || !password) {
    errorMessage.value = 'Vui lòng nhập cả email và mật khẩu.';
    return;
  }

  console.log('--- Đang thực hiện đăng nhập... ---');
  try {
    const response = await axios.post(API_LOGIN, {
      email: email,
      password: password,
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    if (response.status >= 200 && response.status < 300) {
      message.value = 'Đăng nhập thành công!';
      console.log('Đăng nhập thành công, đang cập nhật thông tin người dùng...');
      await me(); // Cập nhật thông tin người dùng và ID sau khi đăng nhập
      loginEmail.value = '';
      loginPassword.value = '';
    } else {
      throw new Error(response.data.message || 'Đăng nhập không thành công.');
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Lỗi đăng nhập từ server.';
    console.error('Lỗi đăng nhập:', error.response?.data || error.message);
  }
};

/**
 * Xử lý đăng xuất người dùng.
 */
const handleLogout = async () => {
  message.value = '';
  errorMessage.value = '';
  console.log('--- Đang thực hiện đăng xuất... ---');

  try {
    const response = await axios.post(API_LOGOUT, {}, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status >= 200 && response.status < 300) {
      message.value = 'Đăng xuất thành công!';
      username.value = 'Tài khoản khách';
      // Lưu lại ID người dùng trước khi xóa để xử lý ghế nếu cần
      const oldUserId = currentUserId.value;
      currentUserId.value = null;

      console.log('Đăng xuất thành công. Đang cập nhật trạng thái ghế của người dùng cũ.');
      // Reset trạng thái các ghế đang được giữ bởi người dùng này về available
      // Dù backend có thể gửi sự kiện, việc này giúp UI phản ứng nhanh hơn
      // seatsData.value.forEach(seat => { // seatsData is not defined in this snippet, commenting out
      //   if (seat.status === 'held' && seat.heldBy === oldUserId) {
      //     updateSeatStatus(seat.id, 'available', null, null);
      //   }
      // });
      // Tùy chọn: loadSeats() nếu muốn đảm bảo đồng bộ hoàn toàn với backend sau logout
      // loadSeats();
    } else {
      throw new Error(response.data.message || 'Đăng xuất không thành công.');
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Lỗi đăng xuất từ server.';
    console.error('Lỗi đăng xuất:', error.response?.data || error.message);
  }
};

/**
 * Gửi tin nhắn trong chatbot. (Placeholder for actual LLM integration)
 */
const sendMessage = async () => {
  if (chatInput.value.trim() === '') return;

  const messageInput = chatInput.value;
  messages.value.push({ sender: 'user', text: chatInput.value });
  const userMessage = chatInput.value;
  chatInput.value = '';

  // Scroll to the bottom after adding a new message
  await nextTick();
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
  }

  // Simulate a bot response (replace with actual LLM API call)
  messages.value.push({ sender: 'bot', text: 'Tôi đang xử lý yêu cầu của bạn...' });
  await nextTick();
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
  }

  // Placeholder for LLM API call
  try {
    const prompt = userMessage;
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = {
      message: messageInput,
      option: null
    };
    const apiUrl = `http://127.0.0.1:8000/api/chatbox`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    console.log(result);


    if (result.error == false) {
      const botResponseText = result.data.answer;
      // Replace the "processing" message with the actual bot response
      messages.value[messages.value.length - 1] = { sender: 'bot', text: botResponseText };
    } else {
      messages.value[messages.value.length - 1] = { sender: 'bot', text: 'Xin lỗi, tôi không thể tạo phản hồi lúc này.' };
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    messages.value[messages.value.length - 1] = { sender: 'bot', text: 'Đã xảy ra lỗi khi kết nối với dịch vụ AI.' };
  }

  await nextTick();
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
  }
};


onMounted(async () => {
  await me(); // Lấy thông tin người dùng khi component được mount
});

onUnmounted(() => {
  // Clear any ongoing countdown intervals if any
  for (const seatId in countdownIntervals) {
    clearInterval(countdownIntervals[seatId]);
    delete countdownIntervals[seatId];
  }
});

</script>

<style scoped>
/* (Giữ nguyên phần CSS của bạn) */
.seat-map-container {
  font-family: 'Inter', Arial, sans-serif;
  /* Changed font to Inter */
  padding: 20px;
  text-align: center;
  max-width: 800px;
  margin: 20px auto;
  background-color: #f0f2f5;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

h2,
h3 {
  color: #333;
  margin-bottom: 20px;
}

#seat-map {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  margin-bottom: 20px;
}

.seat {
  width: 80px;
  height: 80px;
  border: 2px solid #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
}

.seat:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.seat.available {
  background-color: #e6ffe6;
  border-color: #66cc66;
  color: #333;
}

.seat.held {
  background-color: #ffebcc;
  border-color: #ff9933;
  color: #666;
}

.seat.booked {
  background-color: #ffcccc;
  border-color: #ff3333;
  color: #fff;
}

.seat.booked:hover {
  cursor: not-allowed;
}

.countdown-timer {
  font-size: 0.8em;
  color: #777;
  margin-top: 5px;
}

.message {
  margin-top: 20px;
  padding: 10px;
  background-color: #e0f7fa;
  border-left: 5px solid #00bcd4;
  color: #00796b;
  text-align: left;
  border-radius: 4px;
}

.error-message {
  margin-top: 20px;
  padding: 10px;
  background-color: #ffebee;
  border-left: 5px solid #ef5350;
  color: #d32f2f;
  text-align: left;
  border-radius: 4px;
}

.spinner-gif {
  width: 50px;
  height: 50px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* AUTH SECTION STYLES */
.auth-section {
  background-color: #fff;
  /* Changed to white for better contrast */
  border: 1px solid #ddd;
  border-radius: 12px;
  /* Increased border-radius */
  padding: 25px;
  /* Increased padding */
  margin-bottom: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  /* Stronger shadow */
  max-width: 450px;
  /* Slightly wider */
  margin-left: auto;
  margin-right: auto;
}

.auth-section h3 {
  margin-top: 0;
  color: #333;
  font-size: 1.6em;
  /* Slightly larger font */
  margin-bottom: 20px;
}

.login-form .form-group {
  margin-bottom: 18px;
  /* Increased margin */
  text-align: left;
}

.login-form label {
  display: block;
  margin-bottom: 8px;
  /* Increased margin */
  font-weight: bold;
  color: #555;
}

.login-form input[type="email"],
.login-form input[type="password"] {
  width: calc(100% - 24px);
  /* Adjusted for padding */
  padding: 12px;
  /* Increased padding */
  border: 1px solid #ccc;
  border-radius: 6px;
  /* Slightly more rounded */
  font-size: 1.05em;
  /* Slightly larger font */
  box-sizing: border-box;
}

.login-button,
.logout-button {
  padding: 12px 25px;
  /* Increased padding */
  border: none;
  border-radius: 8px;
  /* More rounded */
  cursor: pointer;
  font-size: 1.1em;
  /* Larger font */
  transition: background-color 0.3s ease, transform 0.2s ease;
  width: 100%;
  margin-top: 15px;
  /* Increased margin */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  /* Add shadow to buttons */
}

.login-button {
  background-color: #28a745;
  color: white;
}

.login-button:hover {
  background-color: #218838;
  transform: translateY(-1px);
}

.logout-button {
  background-color: #dc3545;
  color: white;
}

.logout-button:hover {
  background-color: #c82333;
  transform: translateY(-1px);
}

/* CHATBOT STYLES */
.chatbot-container {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 20px;
  margin-top: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: column;
  height: 600px;
  /* Fixed height for the chatbot */
}

.chatbot-container h3 {
  margin-top: 0;
  color: #333;
  font-size: 1.6em;
  margin-bottom: 20px;
}

.chat-messages {
  flex-grow: 1;
  /* Allows messages area to take available space */
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
  /* Enable scrolling for messages */
  background-color: #fefefe;
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  /* Messages stack vertically */
}

.message-bubble {
  max-width: 75%;
  padding: 10px 15px;
  border-radius: 18px;
  margin-bottom: 10px;
  line-height: 1.4;
  word-wrap: break-word;
  /* Ensures long words wrap */
}

.message-bubble.user {
  background-color: #007bff;
  color: white;
  align-self: flex-end;
  /* Align user messages to the right */
  border-bottom-right-radius: 4px;
  /* Sharpen corner on send side */
}

.message-bubble.bot {
  background-color: #e2e6ea;
  color: #333;
  align-self: flex-start;
  /* Align bot messages to the left */
  border-bottom-left-radius: 4px;
  /* Sharpen corner on receive side */
}

.chat-input-area {
  display: flex;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.chat-input {
  flex-grow: 1;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 25px;
  /* Pill shape */
  font-size: 1em;
  outline: none;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.chat-input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.send-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 25px;
  /* Pill shape */
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease, transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.send-button:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

/* Responsive adjustments */
@media (max-width: 768px) {

  .seat-map-container,
  .auth-section,
  .chatbot-container {
    padding: 15px;
    margin: 10px auto;
    border-radius: 8px;
  }

  .login-button,
  .logout-button,
  .send-button {
    padding: 10px 15px;
    font-size: 0.95em;
  }

  .login-form input[type="email"],
  .login-form input[type="password"],
  .chat-input {
    padding: 10px;
    font-size: 0.95em;
  }

  .message-bubble {
    max-width: 85%;
    /* Allow messages to take more width on small screens */
    padding: 8px 12px;
  }
}
</style>
