export const makeMessage = (type: string, value: string): string => {
  return JSON.stringify({ type, value });
};

export const parseMessage = (data: string): { type: string; value: string } => {
  try {
    const message = JSON.parse(data);
    if (
      !message ||
      typeof message !== 'object' ||
      typeof message.type !== 'string' ||
      typeof message.value !== 'string'
    ) {
      throw new Error('Invalid message structure');
    }
    return message;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse message: Invalid JSON');
    }
    if (
      error instanceof Error &&
      error.message === 'Invalid message structure'
    ) {
      throw error;
    }
    throw new Error('Failed to parse message');
  }
};
