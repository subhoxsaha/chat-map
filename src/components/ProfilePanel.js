"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, 
  IconButton, TextField, Button, Avatar as MUIAvatar, useTheme, Chip, 
  CircularProgress, Alert
} from "@mui/material";
import { Close as CloseIcon, Shuffle as ShuffleIcon, Check as CheckIcon } from "@mui/icons-material";

const AVATAR_STYLES = [
  { id: "lorelei",     label: "Lorelei" },
  { id: "avataaars",   label: "Avataaars" },
  { id: "bottts",      label: "Bottts" },
  { id: "adventurer",  label: "Adventurer" },
  { id: "micah",       label: "Micah" },
  { id: "notionists",  label: "Notionists" },
  { id: "fun-emoji",   label: "Fun Emoji" },
  { id: "personas",    label: "Personas" },
];

function dicebearUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

function getDefaultAvatar(seed) {
  // Use the same random picker logic as server.js for consistency
  const DICEBEAR_STYLES = ["lorelei","avataaars","bottts","adventurer","micah","notionists","fun-emoji","personas"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const style = DICEBEAR_STYLES[Math.abs(hash) % DICEBEAR_STYLES.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProfilePanel({ open, sessionUser, onClose, onProfileSaved }) {
  const [displayName, setDisplayName] = useState(sessionUser?.name || "");
  const [activeStyle, setActiveStyle] = useState("lorelei");
  const [seed, setSeed] = useState(sessionUser?.id || "default");
  const [previews, setPreviews] = useState({});
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (!open) return;
    fetch("/api/profile")
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.displayName) setDisplayName(user.displayName);
        if (user?.customAvatar) setSelectedAvatar(user.customAvatar);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const url = dicebearUrl(activeStyle, seed);
    setPreviews(prev => ({ ...prev, [activeStyle]: url }));
  }, [activeStyle, seed]);

  const handleRandomize = () => setSeed(randomSeed());

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          customAvatar: selectedAvatar || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSuccess(true);
      onProfileSaved?.({ displayName: data.user.displayName, customAvatar: data.user.customAvatar });
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const currentPreview = previews[activeStyle] || dicebearUrl(activeStyle, seed);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 4, bgcolor: 'background.paper', backgroundImage: 'none', border: '1px solid', borderColor: 'divider' }
      }}
    >
      <DialogTitle component="div" sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold">Edit Profile</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
          
          {/* Current Avatar Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <MUIAvatar 
              src={selectedAvatar || getDefaultAvatar(sessionUser?.id || "default")} 
              sx={{ width: 64, height: 64, border: '2px solid', borderColor: 'primary.main', bgcolor: 'background.default' }}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">{displayName || sessionUser?.name}</Typography>
              <Typography variant="body2" color="text.secondary">{sessionUser?.email}</Typography>
              {selectedAvatar && (
                <Button size="small" color="error" onClick={() => setSelectedAvatar(null)} sx={{ mt: 0.5, p: 0, minWidth: 0, fontSize: '0.75rem' }}>
                  Reset to Default Avatar
                </Button>
              )}
            </Box>
          </Box>

          {/* Display Name Input */}
          <TextField
            label="Display Name"
            fullWidth
            variant="outlined"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            inputProps={{ maxLength: 40 }}
            placeholder={sessionUser?.name}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />

          {/* DiceBear Avatar Generator */}
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold">Random Avatar Style</Typography>
              <Button size="small" startIcon={<ShuffleIcon />} onClick={handleRandomize} sx={{ textTransform: 'none' }}>
                Randomize
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {AVATAR_STYLES.map(s => (
                <Chip
                  key={s.id}
                  label={s.label}
                  onClick={() => setActiveStyle(s.id)}
                  color={activeStyle === s.id ? "primary" : "default"}
                  variant={activeStyle === s.id ? "filled" : "outlined"}
                  sx={{ borderRadius: 2, fontWeight: activeStyle === s.id ? 'bold' : 'normal' }}
                />
              ))}
            </Box>

            <Box sx={{ 
              display: 'flex', alignItems: 'center', gap: 2, p: 2, 
              borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' 
            }}>
              <MUIAvatar 
                src={currentPreview} 
                sx={{ width: 64, height: 64, bgcolor: 'divider' }} 
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Style: {AVATAR_STYLES.find(s => s.id === activeStyle)?.label}
                </Typography>
                <Button 
                  fullWidth 
                  variant={selectedAvatar === currentPreview ? "contained" : "outlined"} 
                  color={selectedAvatar === currentPreview ? "success" : "primary"}
                  onClick={() => setSelectedAvatar(currentPreview)}
                  startIcon={selectedAvatar === currentPreview ? <CheckIcon /> : null}
                  sx={{ borderRadius: 2 }}
                >
                  {selectedAvatar === currentPreview ? "Selected" : "Use this avatar"}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Status Alerts */}
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ borderRadius: 2 }}>Profile saved successfully!</Alert>}
        
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSave} 
          disabled={saving}
          sx={{ borderRadius: 2, minWidth: 100 }}
        >
          {saving ? <CircularProgress size={24} color="inherit" /> : "Save Profile"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
