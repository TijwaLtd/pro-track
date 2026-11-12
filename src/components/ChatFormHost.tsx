import { ChatForm } from './chat/ChatForm';

/** Mounts the scripted chat form overlay. Rendered once inside the unlocked app shell. */
export function ChatFormHost() {
  return <ChatForm />;
}
