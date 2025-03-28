import { createZodDto } from "nestjs-zod";
import { createGroupSchema } from "../schemas/group.create.schema";

export class CreateGroupDTO extends createZodDto(createGroupSchema) {}