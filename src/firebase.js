// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBhvYEI_L9AX8Av8pQAa0UgCUDGHHb66Rs",
  authDomain: "sistema-dp-daab7.firebaseapp.com",
  projectId: "sistema-dp-daab7",
  storageBucket: "sistema-dp-daab7.firebasestorage.app",
  messagingSenderId: "472627603854",
  appId: "1:472627603854:web:ce6b9439dd36fb5a239cdf",
  measurementId: "G-GNN6992B4Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);