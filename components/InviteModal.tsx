import { View, Text, TouchableOpacity, Modal, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore } from "@/stores/toastStore";
import * as Clipboard from "expo-linking";
import QRCode from "react-native-qrcode-svg";

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  inviteCode: string;
  eventTitle: string;
}

export function InviteModal({ visible, onClose, inviteCode, eventTitle }: InviteModalProps) {
  const webUrl = `https://lnup-demo.vercel.app/invite/${inviteCode}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Du bist eingeladen: ${eventTitle}\n\nTritt bei mit Code: ${inviteCode}\nOder öffne: ${webUrl}`,
      });
    } catch {}
  };

  const handleCopyCode = () => {
    useToastStore.getState().showToast("Code kopiert!", "success");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View className="bg-background rounded-t-3xl px-4 pt-6 pb-10">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-text-primary">Einladen</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B6B80" />
            </TouchableOpacity>
          </View>

          <View className="items-center mb-6">
            <View className="bg-white p-4 rounded-2xl mb-4">
              <QRCode value={webUrl} size={180} backgroundColor="white" color="#0A0A0F" />
            </View>
            <Text className="text-xs text-text-muted mb-1">Einladungscode</Text>
            <TouchableOpacity onPress={handleCopyCode}>
              <Text className="text-3xl font-black text-primary tracking-widest">{inviteCode}</Text>
            </TouchableOpacity>
            <Text className="text-xs text-text-muted mt-1">Tippen zum Kopieren</Text>
          </View>

          <View className="gap-3">
            <TouchableOpacity
              onPress={handleShare}
              className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2"
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-base">Link teilen</Text>
            </TouchableOpacity>

            <View className="bg-card border border-border rounded-xl px-4 py-3">
              <Text className="text-xs text-text-muted mb-1">Web-Link</Text>
              <Text className="text-sm text-text-secondary" numberOfLines={1}>{webUrl}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
