import { conversationRecipientSchema } from "./conversation.recipient.schema";
import { validObjId } from "src/utils/constants";

export const conversationTypingSchema = conversationRecipientSchema.extend({ conversationId: validObjId });