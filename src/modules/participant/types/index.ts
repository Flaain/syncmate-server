import { SchemaTimestampsConfig } from "mongoose";
import { Participant } from "../schemas/participant.schema";
import { Document } from "mongoose";

export type ParticipantDocument = Participant & Document & SchemaTimestampsConfig;