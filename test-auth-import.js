import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";

console.log("NextAuth:", typeof NextAuth === "function" ? "Function" : "Object with default: " + typeof NextAuth.default);
console.log("GoogleProvider:", typeof GoogleProvider === "function" ? "Function" : "Object with default: " + typeof GoogleProvider.default);
console.log("getServerSession:", typeof getServerSession === "function" ? "Function" : "Object with default: " + typeof getServerSession.default);
