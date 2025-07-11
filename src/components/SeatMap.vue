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
          <!-- Conditional rendering for HTML content -->
          <p v-if="msg.isHtml" v-html="msg.text"></p>
          <p v-else>{{ msg.text }}</p>
        </div>
        <!-- Spinner will be displayed here when isTyping is true -->
        <div v-if="isTyping" class="message-bubble bot typing-indicator">
          <img src="http://127.0.0.1:5173/public/spinner.gif" alt="Typing..." class="spinner-gif" />
        </div>
      </div>
      <div class="chat-input-area">
        <input type="text" v-model="chatInput" @keyup.enter="sendMessage" placeholder="Nhập tin nhắn của bạn..."
          class="chat-input" :disabled="isTyping" />
        <button @click="sendMessage" class="send-button" :disabled="isTyping">Gửi</button>
      </div>
    </div>
    <!-- End Chatbot Section -->

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance, nextTick } from 'vue';
import axios from 'axios';

// Get current instance to access global properties exposed via `app.config.globalProperties`
// Ensure Laravel Echo is configured in `main.js` or `plugins/echo.js` and exposed correctly.
// Example in main.js: `app.config.globalProperties.$echo = Echo;`
const { proxy } = getCurrentInstance();
const $echo = proxy.$echo;

// Declare reactive Refs
const username = ref('Tài khoản khách');
const message = ref('');
const errorMessage = ref('');
const countdownIntervals = {}; // Used to store setIntervals for countdown
const currentUserId = ref(null);

// Refs for login form
const loginEmail = ref('');
const loginPassword = ref('');

// Refs and logic for Chatbot
const chatInput = ref('');
const messages = ref([
  { sender: 'bot', text: 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?', isHtml: false } // Added isHtml property
]);
const chatMessagesContainer = ref(null); // Ref to scroll to the bottom of messages
const isTyping = ref(false); // New reactive variable for spinner

// Configure API URLs
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
 * Get current user information from API.
 */
const me = async () => {
  message.value = '';
  errorMessage.value = '';
  console.log('--- Fetching user information (API_ME)... ---');

  try {
    const response = await axios.get(API_ME, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status >= 200 && response.status < 300) {
      username.value = response.data.data.name || 'Logged in user';
      currentUserId.value = response.data.data.id;
      message.value = 'User information loaded successfully!';
      console.log(`Current user: ${username.value} (ID: ${currentUserId.value})`);

      // After having currentUserId, re-initialize countdown for held seats
      // (ensure that if seats are held by the current user, countdown will run)
      // seatsData.value.forEach(seat => { // seatsData is not defined in this snippet, commenting out
      //   if (seat.status === 'held' && seat.heldUntil) {
      //     // Only restart countdown if seat is held and has an expiration time
      //     startCountdown(seat.id, seat.heldUntil);
      //   }
      // });
      console.log('--- User information fetching complete. ---');
    } else {
      errorMessage.value = 'Unexpected response from server when fetching user information.';
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      errorMessage.value = 'You are not logged in or your session has expired. Please log in again.';
      username.value = 'Guest Account';
      currentUserId.value = null;
      console.log('User not logged in or token expired.');
    } else {
      errorMessage.value = error.response?.data?.message || 'Server error when fetching user information.';
    }
    console.error('API /me error:', error);
  }
};

/**
 * Handle user login.
 */
const performLogin = async () => {
  const email = loginEmail.value;
  const password = loginPassword.value;

  message.value = '';
  errorMessage.value = '';

  if (!email || !password) {
    errorMessage.value = 'Please enter both email and password.';
    return;
  }

  console.log('--- Performing login... ---');
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
      message.value = 'Login successful!';
      console.log('Login successful, updating user information...');
      await me(); // Update user information and ID after login
      loginEmail.value = '';
      loginPassword.value = '';
    } else {
      throw new Error(response.data.message || 'Login failed.');
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Server login error.';
    console.error('Login error:', error.response?.data || error.message);
  }
};

/**
 * Handle user logout.
 */
const handleLogout = async () => {
  message.value = '';
  errorMessage.value = '';
  console.log('--- Performing logout... ---');

  try {
    const response = await axios.post(API_LOGOUT, {}, {
      withCredentials: true,
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.status >= 200 && response.status < 300) {
      message.value = 'Logout successful!';
      username.value = 'Guest Account';
      // Save old user ID before clearing to handle seats if necessary
      const oldUserId = currentUserId.value;
      currentUserId.value = null;

      console.log('Logout successful. Updating seat status for old user.');
      // Reset status of seats held by this user to available
      // Although backend might send events, this helps UI react faster
      // seatsData.value.forEach(seat => { // seatsData is not defined in this snippet, commenting out
      //   if (seat.status === 'held' && seat.heldBy === oldUserId) {
      //     updateSeatStatus(seat.id, 'available', null, null);
      //   }
      // });
      // Optional: loadSeats() if you want to ensure full synchronization with backend after logout
      // loadSeats();
    } else {
      throw new Error(response.data.message || 'Logout failed.');
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Server logout error.';
    console.error('Logout error:', error.response?.data || error.message);
  }
};

/**
 * Play notification sound.
 */
const playNotificationSound = () => {
  const audio = new Audio('noti.mp3'); // Replace with your MP3 file URL
  audio.play().catch(e => console.error("Error playing sound:", e));
};

/**
 * Send message in chatbot.
 * Updated to send cookies by adding `credentials: 'include'` to fetch options.
 * Also, changed payload to match your chatbox API (only sends messageInput and option).
 */
const sendMessage = async () => {
  if (chatInput.value.trim() === '') return;

  const messageInput = chatInput.value;
  messages.value.push({ sender: 'user', text: chatInput.value, isHtml: false }); // User messages are always plain text
  chatInput.value = '';

  // Set typing indicator to true
  isTyping.value = true;

  // Scroll to the bottom after adding a new message
  await nextTick();
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
  }

  // Actual API call to your backend chatbox
  try {
    // Payload for your Laravel backend's /api/chatbox endpoint
    const payload = {
      message: messageInput,
      option: null // Assuming 'option' can be null if not used for simple messages
    };
    const apiUrl = `http://127.0.0.1:8000/api/chatbox`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Ensure cookies are sent
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(result);

    // Check response from your backend
    if (response.ok) { // Check if response is successful (status 2xx)
      const botResponseText = result.data.answer || 'No response from bot.';
      let renderedText = botResponseText;
      let isContentHtml = false;

      // Regex to detect markdown HTML block: ```html ... ```
      // This regex is now more robust to handle potential leading/trailing newlines
      const htmlBlockRegex = /^```html\s*([\s\S]*?)\s*```$/;
      const match = botResponseText.match(htmlBlockRegex);

      if (match && match[1]) {
        // Trim any whitespace including newlines from the extracted content
        renderedText = match[1].trim();
        isContentHtml = true;
      }

      messages.value.push({ sender: 'bot', text: renderedText, isHtml: isContentHtml }); // Push the actual bot message
      playNotificationSound(); // Play sound on successful response
    } else if (response.status === 302) {
      // Handle redirect specifically, e.g., if it redirects to login
      messages.value.push({ sender: 'bot', text: 'Session expired or you are not logged in. Please log in again.', isHtml: false });
      console.error('Redirected to login:', result);
    } else {
      // Handle other errors from backend
      const errorData = result.message || 'Unknown error from server.';
      messages.value.push({ sender: 'bot', text: `Error: ${errorData}`, isHtml: false });
      console.error('Server response error:', result);
    }

  } catch (error) {
    console.error('Error calling chatbox API:', error);
    messages.value.push({ sender: 'bot', text: 'An error occurred while connecting to the chatbox service.', isHtml: false });
  } finally {
    // Always set typing indicator to false after response or error
    isTyping.value = false;
    await nextTick();
    if (chatMessagesContainer.value) {
      chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
    }
  }
};


onMounted(async () => {
  await me(); // Get user information when component is mounted
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
/* (Keep your existing CSS) */
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

.typing-indicator {
  padding: 5px 15px;
  /* Adjust padding for spinner */
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-gif {
  width: 30px;
  /* Adjusted size for the spinner */
  height: 30px;
  /* Adjusted size for the spinner */
  /* No need for absolute positioning here, as it's part of the flow */
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

  .spinner-gif {
    width: 25px;
    /* Smaller spinner on small screens */
    height: 25px;
  }
}
</style>
