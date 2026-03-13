import { api } from "./api"
import { User } from "@/types/user"

export async function createUser(user: User) {
    const response = await api.post("/users/", user)
    return response.data
}