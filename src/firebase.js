import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importação do banco necessária

const firebaseConfig = {
  apiKey: "AIzaSyBhvYEI_L9AX8Av8pQAa0UgCUDGHHb66Rs",
  authDomain: "sistema-dp-daab7.firebaseapp.com",
  projectId: "sistema-dp-daab7",
  storageBucket: "sistema-dp-daab7.firebasestorage.app",
  messagingSenderId: "472627603854",
  appId: "1:472627603854:web:ce6b9439dd36fb5a239cdf",
  measurementId: "G-GNN6992B4Z"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// EXPORTAÇÃO DO BANCO (O que estava faltando para o deploy funcionar)
export const db = getFirestore(app);