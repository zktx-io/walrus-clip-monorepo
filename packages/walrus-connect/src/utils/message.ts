export const makeMessage = (type: string, value: string): string => {
  return JSON.stringify({ type, value });
};

export const parseMessage = (data: string): { type: string; value: string } => {
  try {
    const message = JSON.parse(data);
    if (!message.type || !message.value) {
      throw new Error('Invalid message structure');
    }
    return message;
  } catch (error) {
    throw new Error(`Failed to parse message: ${error}`);
  }
};
