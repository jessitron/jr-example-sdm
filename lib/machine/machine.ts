/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import { closeAllClientResponses } from "./clientGetOutsideOfTry";
import { renameMethodTransform } from "./renameMethod";

/**
 * Initialize an sdm definition, and add functionality to it.
 *
 * @param configuration All the configuration for this service
 */
export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine({
        name: "Single Transform Software Delivery Machine",
        configuration,
    });

    sdm.addCodeTransformCommand({
        name: "closeAllClientResponses",
        transform: closeAllClientResponses,
        intent: "ensure responses are closed",
        description: "Ensure all calls to client.get() are wrapped in a try/finally block that closes the responses",
    });

    sdm.addCodeTransformCommand({
        name: "renameOldMethod",
        transform: renameMethodTransform({
            oldMethodName: "oldMethodName",
            globPatterns: "**/*.java",
            newMethodName: "updatedMethodName",
            className: "DefinerOfRenamedMethod"
        }),
        intent: "rename oldMethodName",
        description: "Upgrade calls from DefinerOfRenamedMethod.oldMethodName->updatedMethodName",
    });

    return sdm;
}
