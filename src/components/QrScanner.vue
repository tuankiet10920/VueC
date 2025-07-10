<template>
  <div class="qr-image-scanner">
    <h1>Quét Mã QR từ Hình ảnh</h1>

    <input type="file" id="imageFileInput" accept="image/*" @change="handleFileChange">
    <button @click="scanSelectedFile" :disabled="!selectedFile || isScanning">Quét Mã QR</button>

    <div v-if="isScanning" class="status-message">
      Đang quét hình ảnh...
    </div>

    <div v-if="scannedResult" class="scan-result">
      <h2>Nội dung Mã QR:</h2>
      <p>{{ scannedResult }}</p>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div id="dummy-reader-for-file-scan"
      style="width: 1px; height: 1px; overflow: hidden; position: absolute; left: -9999px; top: -9999px;"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

// Reactive state variables
const selectedFile = ref(null);
const scannedResult = ref('');
const errorMessage = ref('');
const isScanning = ref(false);

// We will create a new Html5Qrcode instance each time scanSelectedFile is called
// and clear it immediately after use. This avoids issues with managing its lifecycle.
// So, no need for `html5QrCodeScanner = null;` or `getHtml5QrCodeScanner` function here.

// Function to handle file input change
const handleFileChange = (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    selectedFile.value = files[0];
    scannedResult.value = ''; // Clear previous result
    errorMessage.value = '';  // Clear previous error
  } else {
    selectedFile.value = null;
  }
};

// Function to start scanning the selected file
const scanSelectedFile = async () => {
  if (!selectedFile.value) {
    errorMessage.value = 'Vui lòng chọn một hình ảnh để quét.';
    return;
  }

  isScanning.value = true;
  scannedResult.value = ''; // Clear previous result
  errorMessage.value = '';  // Clear previous error

  // Khởi tạo Html5Qrcode với ID của div ẩn
  // Đây là giải pháp đáng tin cậy nhất khi thư viện yêu cầu một ID DOM thực sự
  const scanner = new Html5Qrcode("dummy-reader-for-file-scan");

  try {
    const decodedText = await scanner.scanFile(selectedFile.value, false); // `false` for no progress display
    console.log(`Mã QR từ ảnh (Vue): ${decodedText}`);
    scannedResult.value = decodedText;
    errorMessage.value = ''; // Clear error on success

    // Quan trọng: Gọi clear() để giải phóng tài nguyên sau khi quét file
    await scanner.clear();
  } catch (err) {
    console.error(`Không thể quét mã QR từ ảnh (Vue):`, err);
    if (typeof err === 'string' && err.includes("QR Code no found.")) {
      errorMessage.value = 'Không tìm thấy mã QR trong hình ảnh đã chọn.';
    } else {
      errorMessage.value = `Lỗi khi quét ảnh: ${err.message || err}`;
    }
  } finally {
    isScanning.value = false;
  }
};
</script>

<style scoped>
/* (Giữ nguyên phần style) */
.qr-image-scanner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  max-width: 600px;
  margin: 20px auto;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #333;
  margin-bottom: 20px;
}

input[type="file"] {
  margin-bottom: 15px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 10px 20px;
  font-size: 1em;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  transition: background-color 0.2s ease;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status-message {
  margin-top: 15px;
  color: #007bff;
  font-style: italic;
}

.scan-result {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #28a745;
  border-radius: 5px;
  background-color: #e6ffe6;
  color: #28a745;
  width: 90%;
  text-align: center;
}

.error-message {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #dc3545;
  border-radius: 5px;
  background-color: #ffe6e6;
  color: #dc3545;
  width: 90%;
  text-align: center;
}
</style>
