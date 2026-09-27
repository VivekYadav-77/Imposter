package com.impostergame.data.network

import java.util.UUID

data class CommandRequest(
    val routeTemplate: String,
    val encodedPath: String,
    val body: ByteArray,
    val idempotencyKey: String,
    val expectedStateVersion: Long? = null,
    val method: CommandMethod = CommandMethod.POST,
)

enum class CommandMethod {
    POST,
    PATCH,
}

fun interface IdGenerator {
    fun create(): String
}

object UuidIdGenerator : IdGenerator {
    override fun create(): String = UUID.randomUUID().toString()
}

class CommandFactory(private val ids: IdGenerator = UuidIdGenerator) {
    fun create(
        routeTemplate: String,
        encodedPath: String,
        body: ByteArray,
        expectedStateVersion: Long? = null,
        method: CommandMethod = CommandMethod.POST,
    ): CommandRequest =
        CommandRequest(
            routeTemplate = routeTemplate,
            encodedPath = encodedPath,
            body = body.copyOf(),
            idempotencyKey = ids.create(),
            expectedStateVersion = expectedStateVersion,
            method = method,
        )
}
