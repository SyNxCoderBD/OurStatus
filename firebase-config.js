import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyAmdzmJa23bpeVdBBxnzbLHBtiuu5gGBAI",
    authDomain: "mydatabase100-d45ff.firebaseapp.com",
    databaseURL: "https://mydatabase100-d45ff-default-rtdb.firebaseio.com",
    projectId: "mydatabase100-d45ff",
    storageBucket: "mydatabase100-d45ff.appspot.com",
    messagingSenderId: "995667612707",
    appId: "1:995667612707:web:6843132a481e76808a4d96",
    measurementId: "G-TNXWZ6F3CW"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);