import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { lightPalette } from "@/theme/tokens";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastCtx>({
  success: () => {},
  error: () => {},
  info: () => {},
});

/** Top-center toasts (mirrors the web prototype's Sonner placement). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType) => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const api: ToastCtx = {
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={styles.overlay}>
        {items.map((t) => (
          <Toast key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function Toast({ item }: { item: ToastItem }) {
  const [opacity] = useState(() => new Animated.Value(0));
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [opacity]);

  const Icon =
    item.type === "success" ? CheckCircle2 : item.type === "error" ? XCircle : Info;
  const color =
    item.type === "success"
      ? lightPalette.tones.emerald.solid
      : item.type === "error"
      ? lightPalette.tones.rose.solid
      : lightPalette.tones.amber.solid;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Icon size={16} color={color} />
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
    elevation: 100,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(28, 25, 23, 0.94)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: "88%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: { color: "#fafaf9", fontSize: 13, fontWeight: "600", flexShrink: 1 },
});
