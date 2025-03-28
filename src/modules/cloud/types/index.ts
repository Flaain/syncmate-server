import { HydratedDocument, SchemaTimestampsConfig } from "mongoose";
import { Cloud } from "../schemas/cloud.schema";

export type CloudDocument = HydratedDocument<Cloud> & SchemaTimestampsConfig;