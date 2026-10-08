import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

// Lets these third-party components accept `className` (imported once from the root layout).
cssInterop(Image, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
