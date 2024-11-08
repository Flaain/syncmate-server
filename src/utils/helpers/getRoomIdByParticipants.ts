export const getRoomIdByParticipants = (participants: Array<string>, seperator: string = '-') => `conversation:${participants.sort().join(seperator)}`;
