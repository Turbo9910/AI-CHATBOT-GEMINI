import React, { useState, useEffect, useRef } from "react";
import * as GoogleGenerativeAI from "@google/generative-ai";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import FlashMessage, { showMessage } from "react-native-flash-message";

const GeminiChat = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [tripDetails, setTripDetails] = useState({
    destination: "",
    dates: "",
    interests: "",
    budget: "",
  });

  const fadeAnims = useRef(new Map()).current;
  const dotAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  const API_KEY = "YOUR_API_KEY"; 
  const genAI = new GoogleGenerativeAI.GoogleGenerativeAI(API_KEY);

 
  const cleanApiResponse = (responseText) => {
    return responseText.replace(/\*/g, "").trim();
  };

  useEffect(() => {
    const startChat = async () => {
      try {
        setLoading(true);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Hey there! Looking to plan a trip? Let's fulfill your dreams together!";
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = cleanApiResponse(response.text());

        
        const date = new Date();
        const dayDateMessage = {
          id: `date-${Date.now()}`,
          text: date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          type: "date",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

       
        const botMessage = {
          id: Date.now().toString(),
          text: prompt,
          user: false,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages([dayDateMessage, botMessage]);
        fadeAnims.set(dayDateMessage.id, new Animated.Value(0));
        fadeAnims.set(botMessage.id, new Animated.Value(0));
        Animated.timing(fadeAnims.get(dayDateMessage.id), {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        Animated.timing(fadeAnims.get(botMessage.id), {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error("Error in startChat:", error);
        showMessage({
          message: "Error",
          description: "Failed to start chat. Please try again.",
          type: "danger",
        });
      } finally {
        setLoading(false);
      }
    };
    startChat();
  }, []);

 
  useEffect(() => {
    if (typing) {
      const animateDots = () => {
        dotAnims.forEach((anim, index) => {
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              delay: index * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        });
      };
      animateDots();
      const interval = setInterval(animateDots, 1000);
      return () => {
        clearInterval(interval);
        dotAnims.forEach((anim) => anim.setValue(0)); 
      };
    }
  }, [typing, dotAnims]);

  const sendMessage = async (messageText) => {
    try {
      setLoading(true);
      setTyping(true);

      if (editingMessageId) {
        const updatedMessages = messages.map((msg) =>
          msg.id === editingMessageId ? { ...msg, text: messageText || userInput } : msg
        );
        setMessages(updatedMessages);
        setEditingMessageId(null);
        setUserInput("");
        setTyping(false);
        return;
      }

      const userMessage = {
        id: Date.now().toString(),
        text: messageText || userInput,
        user: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([...messages, userMessage]);
      fadeAnims.set(userMessage.id, new Animated.Value(0));
      Animated.timing(fadeAnims.get(userMessage.id), {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      
      const lowerText = userMessage.text.toLowerCase();
      setTripDetails((prev) => ({
        ...prev,
        destination: lowerText.includes("go to") ? userMessage.text.split("go to")[1]?.trim() || prev.destination : prev.destination,
        dates: lowerText.includes("dates") ? userMessage.text.split("dates")[1]?.trim() || prev.dates : prev.dates,
        interests: lowerText.includes("interests") ? userMessage.text.split("interests")[1]?.trim() || prev.interests : prev.interests,
        budget: lowerText.includes("budget") ? userMessage.text.split("budget")[1]?.trim() || prev.budget : prev.budget,
      }));

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const history = messages
        .filter((msg) => msg.type !== "date")
        .map((msg) => ({
          role: msg.user ? "user" : "model",
          parts: [{ text: msg.text }],
        }));
      const lastBotResponse = messages
        .filter((msg) => !msg.user && msg.type !== "date")
        .slice(-1)[0]?.text || "No previous response.";

    
      const enhancedPrompt = `
        You are planning a trip. Here are the details:
        - Destination: ${tripDetails.destination || "Not specified"}
        - Dates: ${tripDetails.dates || "Not specified"}
        - Interests: ${tripDetails.interests || "Not specified"}
        - Budget: ${tripDetails.budget || "Not specified"}
        Previous response: ${lastBotResponse}
        Current message: ${userMessage.text}
        Provide detailed trip planning advice based on the above details, considering the previous response for context.
      `;

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(enhancedPrompt);
      const response = result.response;
      const text = cleanApiResponse(response.text());

      const botMessage = {
        id: Date.now().toString(),
        text,
        user: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([...messages, userMessage, botMessage]);
      fadeAnims.set(botMessage.id, new Animated.Value(0));
      Animated.timing(fadeAnims.get(botMessage.id), {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      setShowOptions(true); // Show options after every user message
      setUserInput("");
    } catch (error) {
      console.error("Error in sendMessage:", error);
      showMessage({
        message: "Error",
        description: "Failed to send message. Please try again.",
        type: "danger",
      });
    } finally {
      setLoading(false);
      setTyping(false);
    }
  };

  const handleOptionPress = (option) => {
    sendMessage(`Tell me about ${option} for my trip to ${tripDetails.destination || "my destination"}`);
  };

  const clearMessages = () => {
    // Preserve the date message
    const dateMessage = messages.find((msg) => msg.type === "date");
    setMessages(dateMessage ? [dateMessage] : []);
    setShowOptions(false);
    setEditingMessageId(null);
    setTripDetails({ destination: "", dates: "", interests: "", budget: "" });
  };

  const handleEditMessage = (message) => {
    if (!message.user) return;
    setEditingMessageId(message.id);
    setUserInput(message.text);
  };

  const renderMessage = ({ item }) => {
    if (item.type === "date") {
      return (
        <Animated.View
          style={[
            styles.dateContainer,
            { opacity: fadeAnims.get(item.id) || 1 },
          ]}
        >
          <Text style={styles.dateText}>{item.text}</Text>
          <View style={styles.divider} />
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          item.user ? styles.userMessageContainer : styles.botMessageContainer,
          { opacity: fadeAnims.get(item.id) || 1 },
        ]}
      >
        {!item.user && (
          <MaterialIcons name="assistant" size={24} color="#000000" style={styles.botAvatar} />
        )}
        <TouchableOpacity onLongPress={() => handleEditMessage(item)} style={styles.messageContent}>
          <Text style={[styles.messageText, item.user ? styles.userMessageText : styles.botMessageText]}>
            {item.text}
          </Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTypingIndicator = () => (
    <View style={styles.typingContainer}>
      <View style={styles.dotContainer}>
        {dotAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[styles.dot, {
              transform: [{
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              }],
            }]}
          />
        ))}
      </View>
    </View>
  );

  const renderOptions = () => (
    <View style={styles.optionsContainer}>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("flights")}>
        <Text style={styles.optionText}>Flights</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("accommodations")}>
        <Text style={styles.optionText}>Accommodations</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("itinerary")}>
        <Text style={styles.optionText}>Itinerary</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("attractions")}>
        <Text style={styles.optionText}>Attractions</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("restaurants")}>
        <Text style={styles.optionText}>Restaurants</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("transportation")}>
        <Text style={styles.optionText}>Transportation</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("packing tips")}>
        <Text style={styles.optionText}>Packing Tips</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("local tips")}>
        <Text style={styles.optionText}>Local Tips</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionButton} onPress={() => handleOptionPress("weather forecast")}>
        <Text style={styles.optionText}>Weather Forecast</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="assistant" size={24} color="#000000" style={styles.botAvatar} />
        <Text style={styles.headerText}>Travel Assistant</Text>
      </View>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContainer}
      />
      {typing && renderTypingIndicator()}
      {showOptions && renderOptions()}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder={editingMessageId ? "Editing message..." : "Type your message..."}
          onChangeText={setUserInput}
          value={userInput}
          onSubmitEditing={() => sendMessage()}
          style={styles.input}
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()}>
          <FontAwesome name="paper-plane" size={24} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.stopIcon} onPress={clearMessages}>
          <FontAwesome name="trash" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    paddingTop: 30,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  chatContainer: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 5,
    padding: 10,
    borderRadius: 15,
    maxWidth: "80%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
    backgroundColor: "#000000",
  },
  botMessageContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#f5f5f5",
  },
  botAvatar: {
    marginRight: 10,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  botMessageText: {
    color: "#000000",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
    alignSelf: "flex-end",
  },
  dateContainer: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  dateText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#CCCCCC",
    marginTop: 5,
    marginHorizontal: 10,
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 15,
    marginVertical: 5,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#a9a9a9",
    marginHorizontal: 2,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    padding: 10,
  },
  optionButton: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    margin: 5,
  },
  optionText: {
    fontSize: 16,
    color: "#000",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    padding: 10,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    height: 50,
    color: "#000",
    marginHorizontal: 5,
  },
  sendButton: {
    padding: 10,
    borderRadius: 25,
    height: 50,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  stopIcon: {
    padding: 10,
    backgroundColor: "#131314",
    borderRadius: 25,
    height: 50,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },
});

export default GeminiChat;