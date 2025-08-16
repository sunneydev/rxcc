import { Box, Text } from "ink";
import { useState, useEffect } from "react";

export function LoadingScreen() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 400);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const dotString = ".".repeat(dots);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height={24}
    >
      <Text> </Text>
      <Text> </Text>
      <Text color="cyan" bold>
        Crimson Phoenix
      </Text>
      <Text> </Text>
      <Text color="gray">Loading{dotString}</Text>
    </Box>
  );
}
