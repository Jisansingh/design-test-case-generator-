from groq import Groq
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Get API key from .env
api_key = os.getenv("GROQ_API_KEY")

# Initialize Groq client
client = Groq(api_key=api_key)

# Structured prompt
prompt = """
Generate software test cases for a login API.

Return ONLY valid JSON in this format:

{
  "functional": [],
  "edge_cases": [],
  "security": []
}

Do not add explanations.
Do not add markdown.
"""

# Send request to Groq
response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[
        {
            "role": "user",
            "content": prompt
        }
    ]
)

# Print generated response
print(response.choices[0].message.content)