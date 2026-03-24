"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box, Typography, Button, Container, Card, CircularProgress, useTheme } from "@mui/material";
import { Lock as LockIcon, Public as PublicIcon, Chat as ChatIcon, Map as MapIcon } from "@mui/icons-material";

// Google Icon SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <Box sx={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const features = [
    { icon: <MapIcon fontSize="small" />, text: "Real-time Location" },
    { icon: <ChatIcon fontSize="small" />, text: "Global & Proximity Chat" },
    { icon: <LockIcon fontSize="small" />, text: "Secure Auth" },
  ];

  return (
    <Box 
      sx={{ 
        width: "100%", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", 
        bgcolor: "background.default", position: "relative", overflow: "hidden" 
      }}
    >
      {/* Decorative Orbs */}
      <Box sx={{
        position: "absolute", top: "10%", left: "15%", width: 300, height: 300,
        bgcolor: "primary.main", borderRadius: "50%", filter: "blur(120px)", opacity: 0.15
      }} />
      <Box sx={{
        position: "absolute", bottom: "10%", right: "15%", width: 300, height: 300,
        bgcolor: "primary.light", borderRadius: "50%", filter: "blur(120px)", opacity: 0.1
      }} />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 10 }}>
        <Card 
          elevation={0}
          sx={{ 
            p: { xs: 4, sm: 6 }, borderRadius: 6, textAlign: "center",
            bgcolor: 'rgba(255, 255, 255, 0.03)', backdropFilter: "blur(20px)",
            border: "1px solid", borderColor: "divider", boxShadow: theme.shadows[10]
          }}
        >
          <Box 
            sx={{ 
              width: 64, height: 64, mx: "auto", mb: 3, borderRadius: 4, 
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: theme.shadows[4]
            }}
          >
            <PublicIcon sx={{ color: "#fff", fontSize: 36 }} />
          </Box>

          <Typography variant="h4" fontWeight="800" gutterBottom color="text.primary">
            Welcome to MapChat
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={5} sx={{ maxWidth: 360, mx: "auto", lineHeight: 1.6 }}>
            Discover and connect with people near you on a live interactive map.
          </Typography>

          <Button 
            variant="contained" 
            fullWidth
            onClick={() => signIn("google")}
            startIcon={<GoogleIcon />}
            sx={{ 
              py: 1.5, borderRadius: 3, fontSize: "1rem", fontWeight: 600,
              bgcolor: "background.paper", color: "text.primary", 
              border: "1px solid", borderColor: "divider",
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            Continue with Google
          </Button>

          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 5 }}>
            {features.map((feature, i) => (
              <Box key={i} sx={{ 
                display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.75, 
                borderRadius: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" 
              }}>
                <Box sx={{ color: "primary.main", display: "flex" }}>{feature.icon}</Box>
                <Typography variant="caption" fontWeight="600" color="text.secondary">
                  {feature.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
