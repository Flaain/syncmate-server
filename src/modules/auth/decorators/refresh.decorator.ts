import { UseGuards } from "@nestjs/common";
import { RefreshGuard } from "../guards/auth.refresh.guard";

export const Refresh = () => UseGuards(RefreshGuard);