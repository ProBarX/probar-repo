import { apiAuth } from "./api"
import { User } from "@/types/user"

export async function createUser(user: User) {
    const response = await apiAuth.post("/api/v1/users/", user)
    return response.data
}
